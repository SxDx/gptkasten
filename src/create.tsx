import { promises as fs } from "fs";
import * as path from "path";
import { getPreferenceValues, LaunchProps, Detail, ActionPanel, Action, showToast } from "@raycast/api";
import fetch from "node-fetch";
import OpenAI from "openai";
import { useState, useEffect } from "react";
import { convert } from "html-to-text";

interface Preferences {
  apiKey: string;
  model: string;
  promptTemplatePath: string;
  zettelkastenPath: string;
}

interface CreateArguments {
  url: string;
}

export default function Command(props: LaunchProps<{ arguments: CreateArguments }>) {
  const [summary, setSummary] = useState("");
  const { apiKey, model, promptTemplatePath } = getPreferenceValues<Preferences>();
  const { url } = props.arguments;

  useEffect(() => {
    async function fetchData() {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }
      const rawContent = await response.text();
      const userPrompt = convert(rawContent, {});

      const systemPrompt = await fs.readFile(promptTemplatePath, "utf-8");

      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content:  userPrompt }
        ],
        model,
      });

      const summary = completion.choices[0].message.content! + "\n\n---\nSource: " + url;
      setSummary(summary);
    }
    fetchData();
  }, [apiKey, model, url]);

  const save = async () => {
    const match = summary.match(/^#\s*(.+?)\s*$/m);
    if (!match) {
      console.error("No headline found");
      return;
    }
    const headline = match[1];
    const filename = headline

    const { zettelkastenPath } = getPreferenceValues<Preferences>();
    const filePath = path.join(zettelkastenPath, filename + ".md");
    await fs.writeFile(filePath, summary);
    await showToast({ title: "Success", message: "Zettelkasten entry saved!" });
  };

  return summary ? (
    <Detail
      markdown={summary}
      actions={
        <ActionPanel>
          <Action title="Save to Zettelkasten" onAction={save} />
          <Action.CopyToClipboard content={summary} />
        </ActionPanel>
      }
    />
  ) : (
    <Detail markdown="Creating Zettelkasten entry..." />
  );
}
