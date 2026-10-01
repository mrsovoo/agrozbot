// Telegram update'larining ishlatiladigan qismi (webhook + agent uchun umumiy)

export type TgUser = {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
};

export type TgChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  is_forum?: boolean;
};

export type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  caption?: string;
  message_thread_id?: number;
  photo?: { file_id: string; file_unique_id: string; width: number }[];
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
  forum_topic_created?: { name: string };
  new_chat_title?: string;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
};

export type TgCallback = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};

export type TgChatMemberUpdated = {
  chat: TgChat;
  from: TgUser;
  new_chat_member: { user: TgUser; status: string };
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallback;
  my_chat_member?: TgChatMemberUpdated;
};