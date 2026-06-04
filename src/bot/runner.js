import { handleBotMessage, shouldRespondToPost } from "./message.js";

export function createMattermostBotRunner({
  client,
  acornOpsClient = null,
  authStore = null,
  websocketFactory,
  logger = console,
  botUsername = "acorn-ops-bot"
}) {
  return {
    async start() {
      const botUser = await client.getMe();
      const socket = websocketFactory(client.websocketUrl());

      socket.addEventListener("open", () => {
        authenticateSocket(socket, client.token);
        logger.log(`AcornOps bot connected to Mattermost as @${botUser.username}`);
      });

      socket.addEventListener("message", async (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.action === "authentication_challenge") {
            authenticateSocket(socket, client.token);
            return;
          }

          if (message.event === "posted") {
            await handlePostedEvent({
              client,
              acornOpsClient,
              authStore,
              event: message,
              botUser,
              botUsername,
              logger
            });
          }
        } catch (error) {
          logger.error(error instanceof Error ? error.message : error);
        }
      });

      socket.addEventListener("error", (event) => {
        logger.error("Mattermost websocket error", event.error ?? event.message ?? event);
      });

      socket.addEventListener("close", () => {
        logger.log("Mattermost websocket closed.");
      });

      return { botUser, socket };
    }
  };
}

function authenticateSocket(socket, token) {
  socket.send(JSON.stringify({
    seq: 1,
    action: "authentication_challenge",
    data: {
      token
    }
  }));
}

export async function handlePostedEvent({
  client,
  acornOpsClient = null,
  authStore = null,
  event,
  botUser,
  botUsername = "acorn-ops-bot",
  logger = console
}) {
  const post = parsePostedPost(event);
  if (!post) {
    return null;
  }

  const channelType = event.data?.channel_type ?? "";
  if (!shouldRespondToPost({
    post,
    botUserId: botUser.id,
    botUsername,
    channelType
  })) {
    return null;
  }

  const response = await handleBotMessage({
    text: post.message ?? "",
    userId: post.user_id,
    userName: event.data?.sender_name ?? "",
    channelType,
    botUsername,
    acornOpsClient,
    authStore
  });

  logger.log(`Responding to Mattermost post ${post.id} in channel ${post.channel_id}.`);
  return await client.createPost({
    channelId: post.channel_id,
    message: response
  });
}

function parsePostedPost(event) {
  const post = event.data?.post;
  if (!post) {
    return null;
  }

  if (typeof post === "object") {
    return post;
  }

  try {
    return JSON.parse(post);
  } catch {
    return null;
  }
}
