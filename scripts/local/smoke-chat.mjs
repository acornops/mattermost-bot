#!/usr/bin/env node

import process from 'node:process';

const [baseUrl, loginId, password, teamName, channelName, botUsername] = process.argv.slice(2);

if (![baseUrl, loginId, password, teamName, channelName, botUsername].every(Boolean)) {
  throw new Error('Usage: smoke-chat.mjs <base-url> <login-id> <password> <team> <channel> <bot-username>');
}

const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/v4`;
const loginResponse = await fetch(`${apiUrl}/users/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ login_id: loginId, password })
});
if (!loginResponse.ok) {
  throw new Error(`Mattermost smoke login failed with HTTP ${loginResponse.status}.`);
}

const token = loginResponse.headers.get('token');
if (!token) {
  throw new Error('Mattermost smoke login did not return a session token.');
}

const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json'
};

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with HTTP ${response.status}.`);
  }
  return response.status === 204 ? null : await response.json();
}

const team = await request(`/teams/name/${encodeURIComponent(teamName)}`);
const channel = await request(`/teams/${encodeURIComponent(team.id)}/channels/name/${encodeURIComponent(channelName)}`);
const bot = await request(`/users/username/${encodeURIComponent(botUsername)}`);
const startedAt = Date.now();
let commandPost;
let replyPost;

try {
  commandPost = await request('/posts', {
    method: 'POST',
    body: JSON.stringify({
      channel_id: channel.id,
      message: `@${botUsername} !help`
    })
  });

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const page = await request(`/channels/${encodeURIComponent(channel.id)}/posts?since=${startedAt}`);
    replyPost = Object.values(page.posts ?? {}).find((post) => (
      post.user_id === bot.id
      && post.create_at >= startedAt
      && post.message.includes('AcornOps commands:')
    ));
    if (replyPost) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!replyPost) {
    throw new Error('The Mattermost bot did not answer the seeded !help command within 15 seconds.');
  }
} finally {
  for (const post of [replyPost, commandPost]) {
    if (!post?.id) continue;
    try {
      await request(`/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
    } catch {
      // A failed cleanup should not hide the actual connectivity result.
    }
  }
}

console.log('Mattermost bot answered a seeded channel command.');
