/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as del from 'del'
import * as path from 'path'
import * as vscode from 'vscode'
import * as nls from 'vscode-nls'
import { mkdtemp } from '../../shared/filesystemUtilities'
import { DefaultSamCliInvoker, SamCliInvoker } from '../../shared/sam/cli'
import { SamDeployWizard, SamDeployWizardResponse } from '../wizards/samDeployWizard'

const localize = nls.loadMessageBundle()

export async function deploySamApplication({
    invoker = new DefaultSamCliInvoker(),
    ...restParams
}: {
    invoker?: SamCliInvoker
    outputChannel: vscode.OutputChannel
}) {
    const args: SamDeployWizardResponse | undefined = await new SamDeployWizard().run()
    if (!args) {
        return
    }

    const { template, s3Bucket, stackName } = args

    const tempFolder = await mkdtemp('samDeploy')
    const outputTemplatePath = path.join(tempFolder, 'template.yaml')
    let stage = 'packaging'
    try {
        restParams.outputChannel.show(true)
        // TODO: Localize
        restParams.outputChannel.appendLine(`Packaging SAM Application to S3 Bucket: ${s3Bucket}`)
        await invoker.package(
            template.fsPath,
            outputTemplatePath,
            s3Bucket
        )

        stage = 'deploying'
        // Deploying can take a very long time for Python Lambda's with native dependencies so user needs feedback
        restParams.outputChannel.appendLine(localize(
          'AWS.samcli.deploy.stackName.initiated',
          'Deploying {0} stack...',
          stackName
        ))
        await invoker.deploy(outputTemplatePath, stackName)
        // TODO: Add nls support
        const msg = `Successfully deployed SAM Application to CloudFormation Stack: ${stackName}`
        restParams.outputChannel.appendLine(msg)
        // TODO: Is this the right way to provide this feedback?
        vscode.window.showInformationMessage(msg)
    } catch (err) {
        // TODO: Add nls support
        const msg = `Failed to deploy SAM application. Error while ${stage}: ${String(err)}`
        restParams.outputChannel.appendLine(msg)
        // TODO: Is this the right way to provide this feedback?
        vscode.window.showWarningMessage(msg)
    } finally {
        await del(tempFolder, {
            force: true
        })
    }
}
