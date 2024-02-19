import * as yaml from 'yaml'

export interface ValueToUpdate {
  /**
   * Key within the Yaml key to update. Nested paths may be represented as an string array (with each element
   * containing the key at one level of nesting) or as a dot-separated path (such as key.child.subkey). The
   * array form allows keys to include dots, whereas the string form does not. If a nested path is provided, 
   * any necessary parent keys will be created as Yaml Maps. If a key along the path reprsents a scalar value
   * (and not a map), an error will be generated.
   */
  key: string | string[];

  /**
   * Optional Yaml 'tag' to assign to the value.
   */
  tag?: string;

  /**
   * New value to set at the document path represented by `key`.
   */
  value: string;
}

export interface UpdateYamlValueOptions {
  /**
   * Original Yaml conent to update. Can be undefined, in which case a new Yaml document will be
   * created.
   */
  content?: string;

  /**
   * Set of key/value pairs to update in the document.
   */
  updatedValues: ValueToUpdate[]
}

/**
 * Sorts a Yaml document Yaml node, recursively sorting each of its children as well. Only Yaml Map nodes 
 * (including those contained in a Sequence) are sorted. Sorting means that the map's contents are ordered
 * by key.
 */
const sortDeep = (node: yaml.ParsedNode | null): void => {
  if (node instanceof yaml.YAMLMap) {
    node.items.sort((itemA, itemB) => (itemA.key < itemB.key ? -1 : itemA.key > itemB.key ? 1 : 0));
    node.items.forEach(item => sortDeep(item.value));
  } else if (node instanceof yaml.YAMLSeq) {
    node.items.forEach(item => sortDeep(item));
  }
}

/**
 * Given a string containing a Yaml document and a set of key/value pairs to update, this function
 * will apply the updates and return a string containing the new Yaml document.
 */
export const updateYamlValues = ({
  content = "",
  updatedValues
}: UpdateYamlValueOptions): string => {
  const document = yaml.parseDocument(content)

  updatedValues.forEach(({ key, tag, value }) => {
    const node = document.createNode(value);
    if (tag !== undefined) {
      node.tag = tag
    }

    const keyPaths = Array.isArray(key) ? key : key.split('.')
    document.setIn(keyPaths, node)
  })

  sortDeep(document.contents);

  return yaml.stringify(document, {
    blockQuote: 'literal',
    collectionStyle: 'block'
  })
}
