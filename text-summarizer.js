import OpenAI from 'openai';
import dotenv from 'dotenv';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import fs from 'fs';

dotenv.config();

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function summarizeWithOpenAI(text) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that creates concise summaries. Generate exactly 3 sentences that capture the key points of the text.' },
      { role: 'user', content: `Please summarize the following text in exactly 3 sentences:\n\n${text}` }
    ],
    temperature: 0.7,
    max_tokens: 300
  });

  return {
    summary: completion.choices[0].message.content,
    usage: completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

// Local fallback summary: take first 3 sentences
function localSummarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const selection = sentences.slice(0, 3).join(' ').trim();
  return { summary: selection || text.trim(), usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
}

async function summarizeText(text) {
  if (openai) {
    try {
      return await summarizeWithOpenAI(text);
    } catch (err) {
      // fall back to local summarize if API call fails
      return localSummarize(text);
    }
  }
  return localSummarize(text);
}

async function main() {
  // If a filename was provided as an arg, use it
  const argv = process.argv.slice(2);
  let userText = '';

  if (argv[0]) {
    try {
      userText = fs.readFileSync(argv[0], 'utf8');
    } catch (err) {
      console.error('Unable to read file:', argv[0], err.message);
      process.exit(1);
    }
  } else {
    const rl = readline.createInterface({ input, output });

    console.log('='.repeat(60));
    console.log('AI TEXT SUMMARIZER (local fallback if no OPENAI_API_KEY)');
    console.log('='.repeat(60));
    console.log('\nEnter or paste your text below:');
    console.log('(Press Ctrl+c when done)\n');

    try {
      for await (const line of rl) {
        userText += line + '\n';
      }
    } catch (error) {
      if (error.code !== 'ERR_USE_AFTER_CLOSE') {
        throw error;
      }
    }

    userText = userText.trim();
  }

  if (!userText) {
    console.log('\nNo text provided. Exiting...');
    process.exit(0);
  }

  console.log('\n' + '='.repeat(60));
  console.log('PROCESSING...');
  console.log('='.repeat(60));

  const { summary, usage } = await summarizeText(userText);

  const originalLength = userText.length;
  const summaryLength = summary.length;

  console.log('\n' + '='.repeat(60));
  console.log('ORIGINAL TEXT LENGTH');
  console.log('='.repeat(60));
  console.log(`Characters: ${originalLength}`);
  console.log(`Words: ${userText.split(/\s+/).length}`);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(summary);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY LENGTH');
  console.log('='.repeat(60));
  console.log(`Characters: ${summaryLength}`);
  console.log(`Words: ${summary.split(/\s+/).length}`);
  console.log(`Reduction: ${((1 - summaryLength / originalLength) * 100).toFixed(1)}%`);

  console.log('\n' + '='.repeat(60));
  console.log('TOKEN USAGE (approx)');
  console.log('='.repeat(60));
  console.log(`Prompt tokens: ${usage.prompt_tokens}`);
  console.log(`Completion tokens: ${usage.completion_tokens}`);
  console.log(`Total tokens: ${usage.total_tokens}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
