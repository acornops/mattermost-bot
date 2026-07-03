import { DEFAULT_MATTERMOST_BOT_USERNAME } from "./config.js";
import { createInMemoryCommandContextStore } from "./commands/context.js";
import { botResponseText, handleBotMessageResult, shouldRespondToPost } from "./message.js";
import { createRunFollowerRegistry } from "./chat/follower.js";

export function createMattermostBotRunner({
  client,
  acornOpsClient = null,
  websocketFactory,
  logger = console,
  botUsername = DEFAULT_MATTERMOST_BOT_USERNAME,
  commandContextStore = createInMemoryCommandContextStore(),
  runFollowerRegistry = null,
  botPublicBaseUrl = "",
  mattermostActionSecret = ""
}) {
  const followers = runFollowerRegistry ?? createRunFollowerRegistry({
    acornOpsClient,
    commandContextStore,
    postFollowUp: async ({ channelId, message, rootId = "" }) => {
      await client.createPost({ channelId, message, rootId });
    },
    logger
  });

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
              event: message,
              botUser,
              botUsername,
              commandContextStore,
              runFollowerRegistry: followers,
              botPublicBaseUrl,
              mattermostActionSecret,
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
  event,
  botUser,
  botUsername = DEFAULT_MATTERMOST_BOT_USERNAME,
  commandContextStore = createInMemoryCommandContextStore(),
  runFollowerRegistry = null,
  botPublicBaseUrl = "",
  mattermostActionSecret = "",
  logger = console
}) {
  const post = parsePostedPost(event);
  if (!post) {
    return null;
  }
  if (post.user_id === botUser.id) {
    return null;
  }

  const channelType = event.data?.channel_type ?? "";
  const threadRootId = post.root_id ?? "";
  const threadChat = threadRootId
    ? commandContextStore.getChatThread?.(post.channel_id, threadRootId)
    : null;
  if (!threadChat && !shouldRespondToPost({
    post,
    botUserId: botUser.id,
    botUsername,
    channelType
  })) {
    return null;
  }

  const result = await handleBotMessageResult({
    text: post.message ?? "",
    userId: post.user_id,
    userName: event.data?.sender_name ?? "",
    channelType,
    botUsername,
    acornOpsClient,
    commandContextStore,
    sourceMessageId: post.id ?? "",
    threadChat,
    channelId: post.channel_id,
    rootId: threadChat?.rootId ?? post.root_id ?? "",
    botPublicBaseUrl,
    mattermostActionSecret
  });
  const response = botResponseText(result);
  const effects = typeof result === "string" ? [] : result.effects ?? [];
  const attachments = typeof result === "string" ? undefined : result.attachments;
  const followers = runFollowerRegistry ?? createRunFollowerRegistry({
    acornOpsClient,
    commandContextStore,
    postFollowUp: async ({ channelId, message, rootId = "" }) => {
      await client.createPost({ channelId, message, rootId });
    },
    logger
  });

  for (const effect of effects) {
    if (effect.type === "abortActiveRun") {
      followers.abort(effect.externalUserId, {
        channelId: effect.channelId ?? "",
        rootId: effect.rootId ?? ""
      });
    }
  }

  logger.log(`Responding to Mattermost post ${post.id} in channel ${post.channel_id}.`);
  const created = await client.createPost({
    channelId: post.channel_id,
    message: response,
    rootId: threadChat?.rootId ?? "",
    attachments
  });

  for (const effect of effects) {
    if (effect.type === "followRun") {
      followers.start({
        ...effect,
        channelId: effect.channelId || post.channel_id,
        rootId: effect.rootId ?? threadChat?.rootId ?? ""
      });
    } else if (effect.type === "createChatThread") {
      const title = effect.title || effect.session?.title || effect.session?.name || effect.session?.id || "AcornOps chat";
      const threadRoot = await client.createPost({
        channelId: post.channel_id,
        message: `Chat #${effect.number} - ${title}`
      });
      commandContextStore.registerChatThread?.(effect.identity.externalUserId, {
        channelId: post.channel_id,
        rootId: threadRoot.id,
        sessionId: effect.session?.id ?? effect.session?.sessionId ?? "",
        sessionName: effect.session?.title ?? effect.session?.name ?? title,
        title,
        number: effect.number,
        status: "open"
      });
    }
  }

  return created;
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
