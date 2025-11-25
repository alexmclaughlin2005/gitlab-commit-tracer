/**
 * Tracing Module
 *
 * Exports the commit tracer and related types for building
 * relationship chains (Commit → MR → Issue → Epic).
 */

export { CommitTracer } from './commit-tracer';
export { ChainCache } from './chain-cache';

export type {
  CommitChain,
  MergeRequestLink,
  IssueLink,
  ChainMetadata,
  TracingStep,
  TracingOptions,
  BatchTraceResult,
  TraceFailure,
  BatchTraceSummary,
  CacheEntry,
  ChainStatistics,
} from './types';
