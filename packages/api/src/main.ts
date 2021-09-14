import fse from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { OpenAPIV2 } from 'openapi-types'
import { assertOpenApi2, MockConfig, ApiConfig } from './utils'
import { mergeDefaultParams, mergeDefaultMockConfig } from './default'
import { isFunction, uniq } from 'lodash'
import { ParsedPathsObject, ParsedPaths, groupByTag } from './parse/path'
import {
  compileInterfaces,
  compileJsDocTypedefs,
  compilePath,
  createDefaultHeadCode,
  formatCode,
} from 'free-swagger-core'
import { INTERFACE_PATH, JSDOC_PATH } from './default'
import { mock } from './mock'

// 使用 free-swagger/free-swagger-cli 时传入 free-swagger-core 的部分参数固定
const DEFAULT_CORE_PARAMS = {
  interface: false,
  recursive: false,
  typedef: false,
}

// code generate
const gen = async (
  config: Required<ApiConfig<OpenAPIV2.Document>>,
  dirPath: string,
  pathsObject?: ParsedPathsObject
): Promise<void> => {
  // 生成 interface
  if (config.lang === 'ts') {
    const interfacePath = path.resolve(dirPath, INTERFACE_PATH)
    fse.ensureFileSync(interfacePath)
    await fse.writeFile(
      interfacePath,
      // @ts-ignore
      compileInterfaces({ source: config.source, url: config._url }).code
    )
  }

  // 生成 typedef
  if (config.lang === 'js') {
    const jsDocPath = path.resolve(dirPath, JSDOC_PATH)
    fse.ensureFileSync(jsDocPath)
    await fse.writeFile(
      jsDocPath,
      // @ts-ignore
      compileJsDocTypedefs({ source: config.source, url: config._url }).code
    )
  }

  // 生成单个 api 文件
  const genApi = async ([filename, parsedPaths]: [
    string,
    ParsedPaths
  ]): Promise<void> => {
    const apiCollectionPath = path.resolve(
      dirPath,
      `${config.filename?.(filename) ?? filename}.${config.lang}`
    )
    fse.ensureFileSync(apiCollectionPath)
    let code = `${createDefaultHeadCode({
      // @ts-ignore
      url: config._url,
      description: config.source.info.description,
      title: config.source.info.title,
      version: config.source.info.version,
      fileDescription:
        config.source.tags?.find((tagItem) => tagItem.name === filename)
          ?.description ?? '',
    })}\n\n`
    const imports: string[] = []

    let apisCode = ''
    parsedPaths.forEach((parsedPath) => {
      const { jsDocCode, code, imports: apiImports } = compilePath(
        {
          ...config,
          ...DEFAULT_CORE_PARAMS,
        },
        parsedPath.url,
        parsedPath.method
      )
      imports.push(...apiImports)
      if (config.lang === 'js') {
        apisCode += jsDocCode + code
      } else {
        apisCode += code
      }
      apisCode += `\n`
    })
    code +=
      config.lang === 'ts' && imports.length
        ? `import {${uniq(imports).join(',')}} from "${INTERFACE_PATH}";`
        : ''
    code += `${config.customImportCode}\n\n`
    code += apisCode

    await fse.writeFile(apiCollectionPath, formatCode(config.lang)(code))
  }

  // typeOnly 只生成 interface/typedef
  // 不生成接口代码
  if (!config.typeOnly && pathsObject) {
    Object.entries(pathsObject).forEach(genApi)
  }
}

// freeSwagger = merge + parse + gen
const freeSwagger = async (
  config: ApiConfig | string,
  events: {
    onChooseApi?: (params: {
      paths: ParsedPathsObject
    }) => Promise<ParsedPathsObject>
  } = {}
): Promise<OpenAPIV2.Document> => {
  const spinner = ora().render()

  // merge + normalize
  const mergedConfig = await mergeDefaultParams(config)

  try {
    if (!assertOpenApi2(mergedConfig)) {
      throw new Error('文档解析错误，请使用 openApi2 规范的文档')
    }
    spinner.start('正在生成文件...')
    fse.ensureDirSync(mergedConfig.root)

    let choosePaths
    // parse
    if (!mergedConfig.typeOnly) {
      fse.ensureDirSync(mergedConfig.root)
      const parsedPathsObject = groupByTag(mergedConfig.source)
      spinner.succeed('api 文件解析完成')
      choosePaths = isFunction(events?.onChooseApi)
        ? await events?.onChooseApi?.({ paths: parsedPathsObject })
        : parsedPathsObject
    }

    // gen
    await gen(mergedConfig, mergedConfig.root, choosePaths)
    spinner.succeed(
      `api 文件生成成功，文件根目录地址: ${chalk.green(mergedConfig.root)}`
    )

    return mergedConfig.source
  } catch (e) {
    spinner.fail(`${chalk.red('api 文件生成失败')}`)
    throw new Error(e)
  }
}

freeSwagger.mock = async (config: MockConfig | string): Promise<void> => {
  const spinner = ora().render()
  spinner.start('正在生成 mock 文件...\n')

  const mergedConfig = await mergeDefaultMockConfig(config)
  await mock(mergedConfig)
  spinner.succeed(
    `mock 文件生成成功，路径: ${chalk.green(
      path.resolve(mergedConfig.mockRoot)
    )}`
  )
}

import * as utils from './utils'
import * as defaults from './default'

Object.assign(freeSwagger, utils, defaults)
module.exports = freeSwagger