import { logger } from '../logger'

/**
 * Options used when writing a file to Github.
 */
export interface WriteRepositoryFileOptions {
  /**
   * New content to write to the file.
   */
  content: string;

  /**
   * Commit message to associate with the new commit.
   * @defaultValue "Automated update to <PATH>"
   */
  message?: string;

  /**
   * Owner (user or organization) of the repository containing the file
   */
  owner: string;

  /**
   * File path (relative to the repository root) of the file to write
   */
  path: string; 

  /**
   * Name of the repository containing the file
   */
  repository: string;

  /**
   * Access token to use for authentication. The token must have the `contents:write` permission set.
   */
  token: string;
}

/**
 * Retrieves the Blob SHA for a file in git. Returns 'undefined' if the file does not exist. 
 * @todo use the Tree API to support files larger than 1MB
 */
export const getBlobSha = async ({
  owner,
  path,
  repository,
  token
}: Pick<WriteRepositoryFileOptions, 'owner' | 'path' | 'repository' | 'token'>): Promise<string | undefined> =>{
  const result = await fetch(`https://api.github.com/repos/${owner}/${repository}/contents/${path}`, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    method: 'HEAD'
  })

  if (result.status === 404) {
    // file does not exist
    return undefined
  }

  if (!result.ok) {
    logger.error({ repository: `${owner}/${repository}`, path, status: result.status, statusText: result.statusText }, 'Failed to retrieve blob SHA')
    throw new Error(`Failed to retrieve blob SHA: ${result.status} ${result.statusText}.`)
  }

  const etag = result.headers.get('ETag') 
  if (etag === null) {
    logger.error({ repository: `${owner}/${repository}`, path, status: result.status, statusText: result.statusText }, 'Failed to retrieve blob SHA: ETag was null')
    throw new Error('Failed to retrieve blob SHA: ETag was null')
  }

  // the sha is returned as the etag header (wrapped in double quotes) 
  return etag === null ? '' : etag.replace(/"/g, '')
}

/**
 * Writes a text file to a Github repository. This method can be used both to create new files, or update an existing file.
 * When creating new files, any missing parent directories will be created. The API used by this method only supports writing 
 * files up to 1MB in size.
 * 
 * This API will create a new commit containing the new or updated file. Writing multiple files in a single commit is not
 * supported.
 * 
 * @todo use the Tree API to support files larger than 1MB
 */
export const writeRepositoryFile = async ({
  content,
  message,
  ...options
}: WriteRepositoryFileOptions): Promise<void> => {
  const {
    owner,
    path,
    repository,
    token
  } = options

  const baseLog = { 
    contentLength: content.length,
    path,
    repository: `${owner}/${repository}`, 
  }

  logger.info(baseLog, `Writing file to Github.`)

  const sha = await getBlobSha(options)
  logger.info(baseLog, `Got blob sha: ${sha}`)

  const commitmessage = message ?? `Automated update to ${path}`

  const payload = {
    content: Buffer.from(content).toString('base64'),
    message: commitmessage,
    sha
  }

  const result = await fetch(`https://api.github.com/repos/${owner}/${repository}/contents/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    method: 'PUT',
    body: JSON.stringify(payload)
  })

  if (!result.ok) {
    if (result.status === 422) {
      const failureMessage = `A SHA is required when updating an existing Github file.`
      logger.error(baseLog, failureMessage)
      throw new Error(failureMessage)
    }

    if (result.status === 409) {
      const failureMessage = `The provided SHA was invalid.`
      logger.error(baseLog, failureMessage)
      throw new Error(failureMessage)
    }

    const failureMessage = `Error updating Gitlab file: ${result.status} ${result.statusText}.`
    logger.error({
      ...baseLog,
      status: result.status,
      statusText: result.statusText
    }, failureMessage)
    throw new Error(failureMessage)
  }

  logger.info(baseLog, 'File written successfully.')
}
