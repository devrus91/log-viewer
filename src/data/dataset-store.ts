import type { ChannelMetadata, DatasetTransfer, LogMetadata } from "@/domain/types";

class DatasetStore {
  private columns = new Map<string, Float64Array>();
  private channelMap = new Map<string, ChannelMetadata>();
  metadata: LogMetadata | null = null;

  load(dataset: DatasetTransfer): void {
    this.clear();
    this.metadata = dataset.metadata;
    Object.entries(dataset.columns).forEach(([id, values]) => this.columns.set(id, values));
    dataset.channels.forEach((channel) => this.channelMap.set(channel.id, channel));
  }

  clear(): void {
    this.columns.clear();
    this.channelMap.clear();
    this.metadata = null;
  }

  getColumn(id: string): Float64Array | undefined {
    return this.columns.get(id);
  }

  setColumn(channel: ChannelMetadata, values: Float64Array): void {
    this.columns.set(channel.id, values);
    this.channelMap.set(channel.id, channel);
  }

  getChannels(): ChannelMetadata[] {
    return Array.from(this.channelMap.values());
  }

  getChannel(id: string): ChannelMetadata | undefined {
    return this.channelMap.get(id);
  }

  getAllColumns(): Record<string, Float64Array> {
    return Object.fromEntries(this.columns.entries());
  }
}

export const datasetStore = new DatasetStore();
