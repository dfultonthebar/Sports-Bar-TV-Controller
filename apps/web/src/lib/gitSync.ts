/**
 * Git Sync Bridge - Re-exports from @sports-bar/utils
 *
 * This file serves as a bridge between the web app and the shared @sports-bar/utils package.
 * It provides the database adapter implementation and re-exports the core functionality.
 */

import { findMany, eq, asc, desc } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'
import {
  syncTodosToGitHub as utilsSyncTodosToGitHub,
  type Todo,
  type GitSyncDatabaseAdapter,
  type GitSyncLogger,
  type GitSyncConfig
} from '@sports-bar/utils'

/**
 * Database adapter implementation for the web app
 */
class WebAppDatabaseAdapter implements GitSyncDatabaseAdapter {
  async getTodos(): Promise<Todo[]> {
    const todosList = await findMany('todos', {
      orderBy: [asc(schema.todos.status), desc(schema.todos.priority), desc(schema.todos.createdAt)]
    });

    // Fetch documents for each todo
    const todos: Todo[] = await Promise.all(
      todosList.map(async (todo): Promise<Todo> => {
        const documents = await findMany('todoDocuments', {
          where: eq(schema.todoDocuments.todoId, todo.id)
        })
        return { ...todo, documents } as Todo
      })
    );

    return todos;
  }
}

/**
 * Logger adapter implementation for the web app
 */
class WebAppLogger implements GitSyncLogger {
  info(message: string, ...args: any[]): void {
    logger.info(message, ...args);
  }

  error(message: string, error?: any): void {
    logger.error(message, error);
  }
}

// Create singleton instances
const dbAdapter = new WebAppDatabaseAdapter();
const loggerAdapter = new WebAppLogger();

/**
 * Sync TODOs to GitHub by updating TODO_LIST.md and committing
 *
 * This is a convenience wrapper around the utils package function that provides
 * the necessary database and logger adapters.
 */
export async function syncTodosToGitHub(commitMessage: string): Promise<void> {
  return utilsSyncTodosToGitHub(commitMessage, dbAdapter, loggerAdapter);
}

// Re-export types for convenience
export type { Todo, GitSyncDatabaseAdapter, GitSyncLogger, GitSyncConfig }
