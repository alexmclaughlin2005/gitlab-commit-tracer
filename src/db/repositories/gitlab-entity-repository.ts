/**
 * Repository for managing GitLab entities (issues, merge requests, epics) in the database
 */

import { db } from '../connection';
import { issues, mergeRequests, epics, projects } from '../schema';
import { eq, inArray, desc } from 'drizzle-orm';

// ============================================================================
// PROJECT OPERATIONS
// ============================================================================

export interface SaveProjectParams {
  id: string;
  name: string;
  description?: string;
  webUrl?: string;
  isMonitored?: boolean;
}

export async function saveProject(params: SaveProjectParams) {
  const result = await db
    .insert(projects)
    .values({
      id: params.id,
      name: params.name,
      description: params.description,
      webUrl: params.webUrl,
      isMonitored: params.isMonitored ?? true,
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: {
        name: params.name,
        description: params.description,
        webUrl: params.webUrl,
        isMonitored: params.isMonitored ?? true,
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
  iid: number;
  projectId: string;
  title: string;
  description?: string;
  state?: string;
  labels?: string[];
  webUrl?: string;
  authorName?: string;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date;
}

export async function saveIssue(params: SaveIssueParams) {
  const result = await db
    .insert(issues)
    .values({
      iid: params.iid,
      projectId: params.projectId,
      title: params.title,
      description: params.description,
      state: params.state,
      labels: params.labels || [],
      webUrl: params.webUrl,
      authorName: params.authorName,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      closedAt: params.closedAt,
    })
    .onConflictDoUpdate({
      target: [issues.iid, issues.projectId],
      set: {
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
    .where(eq(issues.iid, iid))
    .where(eq(issues.projectId, projectId))
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
  iid: number;
  projectId: string;
  title: string;
  description?: string;
  state?: string;
  sourceBranch?: string;
  targetBranch?: string;
  webUrl?: string;
  authorName?: string;
  createdAt?: Date;
  updatedAt?: Date;
  mergedAt?: Date;
  closedAt?: Date;
}

export async function saveMergeRequest(params: SaveMergeRequestParams) {
  const result = await db
    .insert(mergeRequests)
    .values({
      iid: params.iid,
      projectId: params.projectId,
      title: params.title,
      description: params.description,
      state: params.state,
      sourceBranch: params.sourceBranch,
      targetBranch: params.targetBranch,
      webUrl: params.webUrl,
      authorName: params.authorName,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      mergedAt: params.mergedAt,
      closedAt: params.closedAt,
    })
    .onConflictDoUpdate({
      target: [mergeRequests.iid, mergeRequests.projectId],
      set: {
        title: params.title,
        description: params.description,
        state: params.state,
        sourceBranch: params.sourceBranch,
        targetBranch: params.targetBranch,
        webUrl: params.webUrl,
        updatedAt: params.updatedAt,
        mergedAt: params.mergedAt,
        closedAt: params.closedAt,
      },
    })
    .returning();

  return result[0];
}

export async function getMergeRequestByIid(iid: number, projectId: string) {
  const result = await db
    .select()
    .from(mergeRequests)
    .where(eq(mergeRequests.iid, iid))
    .where(eq(mergeRequests.projectId, projectId))
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

// ============================================================================
// EPIC OPERATIONS
// ============================================================================

export interface SaveEpicParams {
  id: number;
  groupId: string;
  iid: number;
  title: string;
  description?: string;
  state?: string;
  labels?: string[];
  webUrl?: string;
  authorName?: string;
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
      labels: params.labels || [],
      webUrl: params.webUrl,
      authorName: params.authorName,
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
        labels: params.labels || [],
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
