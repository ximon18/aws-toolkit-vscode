/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import { SpawnOptions } from 'child_process'
import * as vscode from 'vscode'
import { SamLambdaRuntime } from '../../../lambda/models/samLambdaRuntime'
import { extensionSettingsPrefix } from '../../constants'
import { fileExists } from '../../filesystemUtilities'
import { DefaultSettingsConfiguration } from '../../settingsConfiguration'
import { ChildProcess, ChildProcessResult } from '../../utilities/childProcess'
import { DefaultSamCliConfiguration, SamCliConfiguration } from './samCliConfiguration'
import { DefaultSamCliLocationProvider } from './samCliLocator'

export const MINIMUM_SAM_CLI_VERSION_INCLUSIVE = '0.7.0'
export const MAXIMUM_SAM_CLI_VERSION_EXCLUSIVE = '0.16.0'

export interface SamInitArgs {
    name: string,
    runtime: SamLambdaRuntime,
    location: vscode.Uri
}

export interface SamCliInvoker {
    build(
        buildDir: string,
        baseDir: string,
        templatePath: string
    ): Promise<void>

    deploy(
        templateFile: string,
        stackName: string
    ): Promise<void>

    info(): Promise<{ version: string }>

    init(args: SamInitArgs): Promise<void>

    localInvoke(
        templateResourceName: string,
        templatePath: string,
        eventPath: string,
        environmentVariablePath: string,
        debugPort?: string
    ): Promise<void>

    package(
        templateFile: string,
        outputTemplateFile: string,
        s3Bucket: string
    ): Promise<void>
}

export class DefaultSamCliInvoker {
    public constructor(
        private readonly processInvoker: SamCliProcessInvoker = new DefaultSamCliProcessInvoker(),
        private readonly taskInvoker: SamCliTaskInvoker = new DefaultSamCliTaskInvoker()
    ) {
    }

    public async build(
        buildDir: string,
        baseDir: string,
        templatePath: string
    ): Promise<void> {
        if (!await fileExists(templatePath)) {
            throw new Error(`template path does not exist: ${templatePath}`)
        }

        this.validateProcessResult(
            'build',
            await this.processInvoker.invoke(
                'build',
                '--build-dir', buildDir,
                '--base-dir', baseDir,
                '--template', templatePath
            )
        )
    }

    public async deploy(
        templateFile: string,
        stackName: string
    ): Promise<void> {
        this.validateProcessResult(
            'deploy',
            await this.processInvoker.invoke(
                'deploy',
                '--template-file', templateFile,
                '--stack-name', stackName,
                '--capabilities', 'CAPABILITY_IAM'
            )
        )
    }

    public async info(): Promise<{ version: string }> {
        const result = await this.processInvoker.invoke('--info')
        this.validateProcessResult('info', result)

        try {
            return JSON.parse(result.stdout) as { version: string }
        } catch (err) {
            throw new Error('SAM CLI did not return expected data')
        }
    }

    public async init(
        {
            name,
            runtime,
            location
        }: SamInitArgs
    ): Promise<void> {
        this.validateProcessResult(
            'init',
            await this.processInvoker.invoke(
                { cwd: location.fsPath },
                'init',
                '--name', name,
                '--runtime', runtime
            )
        )
    }

    public async localInvoke(
        templateResourceName: string,
        templatePath: string,
        eventPath: string,
        environmentVariablePath: string,
        debugPort?: string
    ): Promise<void> {
        if (!templateResourceName) {
            throw new Error('template resource name is missing or empty')
        }

        if (!await fileExists(templatePath)) {
            throw new Error(`template path does not exist: ${templatePath}`)
        }

        if (!await fileExists(eventPath)) {
            throw new Error(`event path does not exist: ${eventPath}`)
        }

        const args = [
            'local',
            'invoke',
            templateResourceName,
            '--template',
            templatePath,
            '--event',
            eventPath,
            '--env-vars',
            environmentVariablePath
        ]
        if (debugPort) {
            args.push('-d', debugPort)
        }

        const execution = new vscode.ShellExecution('sam', args)

        await this.taskInvoker.invoke(new vscode.Task(
            {
                type: 'samLocalInvoke',
            },
            vscode.TaskScope.Workspace,
            'LocalLambdaDebug',
            'SAM CLI',
            execution
        ))
    }

    public async package(
        templateFile: string,
        outputTemplateFile: string,
        s3Bucket: string
    ): Promise<void> {
        this.validateProcessResult(
            'package',
            await this.processInvoker.invoke(
                'package',
                '--template-file', templateFile,
                '--s3-bucket', s3Bucket,
                '--output-template-file', outputTemplateFile
            )
        )
    }

    private validateProcessResult(
        command: keyof SamCliInvoker,
        { exitCode, error, stderr, stdout }: ChildProcessResult
    ): void {
        if (exitCode === 0) {
            return
        }

        console.error(`SAM ${command} error`)
        console.error(`Exit code: ${exitCode}`)
        console.error(`Error: ${error}`)
        console.error(`stderr: ${stderr}`)
        console.error(`stdout: ${stdout}`)

        const message = error && error.message ? error.message : stderr || stdout
        throw new Error(`sam ${command} encountered an error: ${message}`)
    }
}

export interface SamCliProcessInvoker {
    invoke(options: SpawnOptions, ...args: string[]): Promise<ChildProcessResult>
    invoke(...args: string[]): Promise<ChildProcessResult>
}

export interface SamCliTaskInvoker {
    invoke(task: vscode.Task): Promise<vscode.TaskExecution>
}

export class DefaultSamCliProcessInvoker implements SamCliProcessInvoker {
    public constructor(private readonly config: SamCliConfiguration = new DefaultSamCliConfiguration(
        new DefaultSettingsConfiguration(extensionSettingsPrefix),
        new DefaultSamCliLocationProvider()
    )) {
    }

    public invoke(options: SpawnOptions, ...args: string[]): Promise<ChildProcessResult>
    public invoke(...args: string[]): Promise<ChildProcessResult>
    public async invoke(first: SpawnOptions | string, ...rest: string[]): Promise<ChildProcessResult> {
        const args = typeof first === 'string' ? [ first, ...rest ] : rest
        const options: SpawnOptions | undefined = typeof first === 'string' ? undefined : first

        const samCliLocation = this.config.getSamCliLocation()
        if (!samCliLocation) {
            throw new Error('SAM CLI location not configured')
        }

        const childProcess: ChildProcess = new ChildProcess(samCliLocation, options, ...args)

        return await childProcess.run()
    }
}

export class DefaultSamCliTaskInvoker implements SamCliTaskInvoker {
    public async invoke(task: vscode.Task): Promise<vscode.TaskExecution> {
        return await vscode.tasks.executeTask(task)
    }
}
