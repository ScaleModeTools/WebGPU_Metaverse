import type {
  MetaverseJoinRoomRequest,
  MetaverseMatchModeId,
  MetaverseNextMatchRequest,
  MetaverseQuickJoinRoomRequest,
  MetaverseRoomAssignmentSnapshot,
  MetaverseRoomDirectorySnapshot,
  MetaverseRoomId
} from "@webgpu-metaverse/shared";

export interface MetaverseRoomDirectoryClientConfig {
  readonly roomCollectionPath: string;
  readonly serverOrigin: string;
}

export interface MetaverseRoomDirectoryClientRuntime {
  fetchSnapshot(
    matchMode?: MetaverseMatchModeId
  ): Promise<MetaverseRoomDirectorySnapshot>;
  joinRoom(
    roomId: MetaverseRoomId,
    request: MetaverseJoinRoomRequest
  ): Promise<MetaverseRoomAssignmentSnapshot>;
  quickJoinRoom(
    request: MetaverseQuickJoinRoomRequest
  ): Promise<MetaverseRoomAssignmentSnapshot>;
  requestNextMatch(
    roomId: MetaverseRoomId,
    request: MetaverseNextMatchRequest
  ): Promise<MetaverseRoomAssignmentSnapshot>;
}
