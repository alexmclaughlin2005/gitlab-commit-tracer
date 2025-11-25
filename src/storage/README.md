# Storage Module

This module handles data persistence for commits, relationships, and analysis results.

## Purpose

- Store commit data and metadata
- Store relationship chains (Commit → MR → Issue → Epic)
- Store AI analysis results
- Provide query interface for historical data

## Structure

- `database.ts` - Database connection and initialization
- `models.ts` - Data models/schemas
- `repositories/` - Data access layer for each entity type

## Data Models

### Commit
- SHA, message, author, timestamp
- Diff summary
- Link to MR

### MergeRequest
- IID, title, description
- Link to Issue(s)

### Issue
- IID, title, description, labels
- Link to Epic

### Epic
- ID, title, description, objectives

### Analysis
- Commit SHA (foreign key)
- Reason, approach, impact
- Confidence score
- Timestamp

## Storage Options

To be decided:
- SQLite (lightweight, local)
- PostgreSQL (production-ready)
- MongoDB (flexible schema)

## Usage

(To be documented as implementation progresses)
