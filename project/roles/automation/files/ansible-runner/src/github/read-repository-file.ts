import { logger } from '../logger'

/**
 * Options used when retrieving a file from Github.
 */
export interface ReadRepositoryFileOptions {
  /**
   * Owner (user or organization) of the repository containing the file
   */
  owner: string;

  /**
   * File path (relative to the repository root) of the file to read
   */
  path: string; 

  /**
   * Name of the repository containing the file
   */
  repository: string;

  /**
   * Access token to use for authentication. The token must have the `contents:read` permission set.
   */
  token: string;
}

/**
 * Reads a text file from a Github repository, and returns it as a string. This method will behave unpredictably
 * if the repository file is a binary. The API used by this method only supports reading files up to 1MB in size.
 * 
 * @todo support files >1MB (if needed)
 * @todo support binary files (if needed)
 */
export const readRepositoryFile = async ({
  owner,
  path,
  repository,
  token
}: ReadRepositoryFileOptions): Promise<string> => {
  logger.info({ 
    path,
    repository: `${owner}/${repository}`, 
  }, `Reading file from Github.`)

  const result = await fetch(`https://api.github.com/repos/${owner}/${repository}/contents/${path}`, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  return await result.text();
}
