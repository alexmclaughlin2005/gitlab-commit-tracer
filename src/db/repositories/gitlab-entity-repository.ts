/**
 * Repository for managing GitLab entities (issues, merge requests, epics) in the database
 */

import { db } from '../connection';
import { issues, mergeRequests, epics, projects } from '../schema';
import { eq, inArray, desc, and } from 'drizzle-orm';

// ============================================================================
// PROJECT OPERATIONS
// ============================================================================

export interface SaveProjectParams {
  id: string;
  name: string;
  gitlabUrl?: string;
  enabled?: boolean;
}

export async function saveProject(params: SaveProjectParams) {
  const result = await db
    .insert(projects)
    .values({
      id: params.id,
      name: params.name,
      gitlabUrl: params.gitlabUrl || '',
      enabled: params.enabled ?? true,
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: {
        name: params.name,
        gitlabUrl: params.gitlabUrl || '',
        enabled: params.enabled ?? true,
      },
    })
    .returning();

  return result[0];
}

export async function getProjectById(id: string) {
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0] || null;
}

export async function getAllProjects() {
  return db.select().from(projects).orderBy(projects.name);
}

// ============================================================================
// ISSUE OPERATIONS
// ============================================================================

export interface SaveIssueParams {
  id: number;
  iid: number;
  projectId: string;
  epicId?: number;
  teamId?: number;
  title: string;
  description?: string;
  state?: string;
  labels?: string[];
  webUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date;
}

export async function saveIssue(params: SaveIssueParams) {
  const result = await db
    .insert(issues)
    .values({
      id: params.id,
      iid: params.iid,
      projectId: params.projectId,
      epicId: params.epicId,
      teamId: params.teamId,
      title: params.title,
      description: params.description,
      state: params.state,
      labels: params.labels || [],
      webUrl: params.webUrl,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      closedAt: params.closedAt,
    })
    .onConflictDoUpdate({
      target: issues.id,
      set: {
        epicId: params.epicId,
        teamId: params.teamId,
        title: params.title,
        description: params.description,
        state: params.state,
        labels: params.labels || [],
        webUrl: params.webUrl,
        updatedAt: params.updatedAt,
        closedAt: params.closedAt,
      },
    })
    .returning();

  return result[0];
}

export async function getIssueByIid(iid: number, projectId: string) {
  const result = await db
    .select()
    .from(issues)
    .where(and(eq(issues.iid, iid), eq(issues.projectId, projectId)))
    .limit(1);
  return result[0] || null;
}

export async function getIssuesByProject(projectId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.projectId, projectId))
    .orderBy(desc(issues.createdAt));
}

// ============================================================================
// MERGE REQUEST OPERATIONS
// ============================================================================

export interface SaveMergeRequestParams {
  id: number;
  iid: number;
  projectId: string;
  title: string;
  description?: string;
  state?: string;
  sourceBranch?: string;
  targetBranch?: string;
  authorName?: string;
  authorUsername?: string;
  labels?: string[];
  upvotes?: number;
  downvotes?: number;
  userNotesCount?: number;
  webUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  mergedAt?: Date;
}

export async function saveMergeRequest(params: SaveMergeRequestParams) {
  const result = await db
    .insert(mergeRequests)
    .values({
      id: params.id,
      iid: params.iid,
      projectId: params.projectId,
      title: params.title,
      description: params.description,
      state: params.state,
      sourceBranch: params.sourceBranch,
      targetBranch: params.targetBranch,
      authorName: params.authorName,
      authorUsername: params.authorUsername,
      labels: params.labels || [],
      upvotes: params.upvotes,
      downvotes: params.downvotes,
      userNotesCount: params.userNotesCount,
      webUrl: params.webUrl,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      mergedAt: params.mergedAt,
    })
    .onConflictDoUpdate({
      target: mergeRequests.id,
      set: {
        title: params.title,
        description: params.description,
        state: params.state,
        sourceBranch: params.sourceBranch,
        targetBranch: params.targetBranch,
        authorName: params.authorName,
        authorUsername: params.authorUsername,
        labels: params.labels || [],
        upvotes: params.upvotes,
        downvotes: params.downvotes,
        userNotesCount: params.userNotesCount,
        webUrl: params.webUrl,
        updatedAt: params.updatedAt,
        mergedAt: params.mergedAt,
      },
    })
    .returning();

  return result[0];
}

export async function getMergeRequestByIid(iid: number, projectId: string) {
  const result = await db
    .select()
    .from(mergeRequests)
    .where(and(eq(mergeRequests.iid, iid), eq(mergeRequests.projectId, projectId)))
    .limit(1);
  return result[0] || null;
}

export async function getMergeRequestsByProject(projectId: string) {
  return db
    .select()
    .from(mergeRequests)
    .where(eq(mergeRequests.projectId, projectId))
    .orderBy(desc(mergeRequests.createdAt));
}

export interface GetAllMergeRequestsParams {
  state?: 'opened' | 'closed' | 'merged' | 'all';
  projectId?: string;
  limit?: number;
  offset?: number;
}

export async function getAllMergeRequests(params: GetAllMergeRequestsParams = {}) {
  const { state, projectId, limit = 100, offset = 0 } = params;

  let query = db.select().from(mergeRequests);

  // Apply filters
  const conditions = [];
  if (projectId) {
    conditions.push(eq(mergeRequests.projectId, projectId));
  }
  if (state && state !== 'all') {
    conditions.push(eq(mergeRequests.state, state));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  // Apply ordering and pagination
  const results = await query
    .orderBy(desc(mergeRequests.updatedAt))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getMergeRequestsCount(params: { state?: string; projectId?: string } = {}) {
  const { state, projectId } = params;

  let query = db.select({ count: mergeRequests.id }).from(mergeRequests);

  const conditions = [];
  if (projectId) {
    conditions.push(eq(mergeRequests.projectId, projectId));
  }
  if (state && state !== 'all') {
    conditions.push(eq(mergeRequests.state, state));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const result = await query;
  return result.length;
}

export async function saveMergeRequestBatch(mergeRequestsData: SaveMergeRequestParams[]) {
  if (mergeRequestsData.length === 0) return [];

  const results = [];
  for (const mrData of mergeRequestsData) {
    const result = await saveMergeRequest(mrData);
    results.push(result);
  }

  return results;
}

// ============================================================================
// EPIC OPERATIONS
// ============================================================================

export interface SaveEpicParams {
  id: number;
  groupId: number;
  iid: number;
  title: string;
  description?: string;
  state?: string;
  webUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date;
}

export async function saveEpic(params: SaveEpicParams) {
  const result = await db
    .insert(epics)
    .values({
      id: params.id,
      groupId: params.groupId,
      iid: params.iid,
      title: params.title,
      description: params.description,
      state: params.state,
      webUrl: params.webUrl,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      closedAt: params.closedAt,
    })
    .onConflictDoUpdate({
      target: epics.id,
      set: {
        title: params.title,
        description: params.description,
        state: params.state,
        webUrl: params.webUrl,
        updatedAt: params.updatedAt,
        closedAt: params.closedAt,
      },
    })
    .returning();

  return result[0];
}

export async function getEpicById(id: number) {
  const result = await db.select().from(epics).where(eq(epics.id, id)).limit(1);
  return result[0] || null;
}

export async function getEpicsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(epics).where(inArray(epics.id, ids)).orderBy(desc(epics.createdAt));
}

export async function getAllEpics() {
  return db.select().from(epics).orderBy(desc(epics.createdAt));
}

export async function getEpicsByState(state: string) {
  return db.select().from(epics).where(eq(epics.state, state)).orderBy(desc(epics.updatedAt));
}
