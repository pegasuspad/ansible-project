import fs from 'fs'

export const loadUpdatedCertificates = (): string[] => {
  const updatedCertificatesFile = process.env.UPDATED_CERTIFICATES_FILE
  if (!updatedCertificatesFile) {
    throw new Error('Missing required environment variable: UPDATED_CERTIFICATES_FILE')
  }

  if (!fs.existsSync(updatedCertificatesFile)) {
    return []
  }

  const json = fs.readFileSync(updatedCertificatesFile, 'utf-8')
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      throw new Error('File did not contain a valid JSON array.')
    }

    return parsed.map(value => String(value));
  } catch (err) {
    console.warn(`Error parsing updated certificates file. Ignoring content: ${json}`, err)
    return []
  }
}
