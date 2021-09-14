import { CoreConfig } from '../utils'
import { jsTemplate, tsTemplate } from './template'
import { OpenAPIV2 } from 'openapi-types'
import { sortBy, uniq, flattenDeep, mapKeys, upperFirst } from 'lodash'
import dayjs from 'dayjs'

export const createTagsByPaths = (
  paths: OpenAPIV2.PathsObject
): OpenAPIV2.TagObject[] =>
  // @ts-ignore
  sortBy(
    uniq(
      flattenDeep(
        Object.values(paths).map((item: OpenAPIV2.PathItemObject) =>
          Object.values(item).map(
            (item: OpenAPIV2.OperationObject) => item.tags
          )
        )
      ).filter(Boolean)
    )
  ).map((item) => ({ name: item }))

// 部分 swagger 文档会存在 a.b 的 model 定义
// abc.def.ghi -> AbcDefGhi
export const normalizeDefinitionName = (name: string) =>
  upperFirst(name.replace(/\.(\w)/g, (_, $1) => $1.toUpperCase()))

export const normalizeDefinitions = (
  definitions: OpenAPIV2.DefinitionsObject
) => mapKeys(definitions, (value, key) => normalizeDefinitionName(key))

// 补充缺失的 source 属性
export const normalizeSource = (source: OpenAPIV2.Document) => ({
  ...source,
  tags: source.tags ?? createTagsByPaths(source.paths),
  definitions: normalizeDefinitions(source.definitions!),
})

// 合并默认参数
export const mergeDefaultParams = (
  config: CoreConfig
): Required<CoreConfig> => {
  const normalizedSource = normalizeSource(config.source)
  return {
    jsDoc: true,
    interface: false,
    typedef: false,
    recursive: false,
    lang: 'js',
    templateFunction:
      config.lang === 'ts' ? eval(tsTemplate) : eval(jsTemplate),
    ...config,
    source: normalizedSource,
  }
}

export const createDefaultHeadCode = ({
  url,
  description,
  title,
  version,
  fileDescription,
}: {
  url?: string
  description?: string
  title?: string
  version?: string
  fileDescription?: string
}) => {
  return `/* eslint-disable */
// @ts-nocheck

/**
 * generated by free-swagger
 * @see https://www.npmjs.com/package/free-swagger
${title ? ` * @title ${title}\n` : ''}${
    description ? ` * @description ${description}\n` : ''
  }${fileDescription ? ` * @fileDescription ${fileDescription}\n` : ''}${
    url ? ` * @host ${url}\n` : ''
  }${version ? ` * @version ${version}\n` : ''} * @date ${dayjs(
    Date.now()
  ).format('YYYY-MM-DD HH:mm')}
**/`
}