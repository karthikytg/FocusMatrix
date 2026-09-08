const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'FocusMatrix-standalone')
const appDirectory = path.join(output, 'resources', 'app')
const electronDirectory = path.join(root, 'node_modules', 'electron', 'dist')

fs.rmSync(output, { recursive: true, force: true })
fs.mkdirSync(appDirectory, { recursive: true })
fs.cpSync(electronDirectory, output, { recursive: true })
fs.cpSync(path.join(root, 'dist'), path.join(appDirectory, 'dist'), { recursive: true })
fs.cpSync(__dirname, path.join(appDirectory, 'electron'), { recursive: true })
fs.copyFileSync(path.join(root, 'package.json'), path.join(appDirectory, 'package.json'))
fs.renameSync(path.join(output, 'electron.exe'), path.join(output, 'FocusMatrix.exe'))

console.log(`Portable app created at ${path.join(output, 'FocusMatrix.exe')}`)