export type TopicDTO = {
  id: number;
  groupId: number;
  threadId: string;
  name: string;
};

export type GroupDTO = {
  id: number;
  chatId: string;
  title: string;
  username: string | null;
  category: string;
  isForum: boolean;
  active: boolean;
  cleanJoinLeave: boolean;
  memberCount: number | null;
  botIsAdmin: boolean;
  botCanDelete: boolean;
  memberCountUpdatedAt: string | null;
  topics: TopicDTO[];
};

export type PostTargetDTO = {
  id: number;
  group: string;
  status: string;
  error: string | null;
};

export type PostDTO = {
  id: number;
  title: string;
  body: string;
  hasImage: boolean;
  status: string;
  source: string;
  createdAt: string;
  targets: PostTargetDTO[];
};
