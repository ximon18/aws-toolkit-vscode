/*!
 * Copyright 2018-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as assert from 'assert'
import * as path from 'path'
import * as vscode from 'vscode'
import { TestService } from './contracts/testService'

const SECOND = 1000
const TIMEOUT = 20 * SECOND

// tslint:disable:no-invalid-this Use of `this` is required to access the mocha context, which is
//                                in turn required to override the default timeout.
// TODO: Increase the default timeout instead of overriding on a test-by-test basis.

describe('Proof of Concept', async () => {
    it('activates the extension', async function() {
        this.timeout(TIMEOUT)

        const extension: vscode.Extension<TestService> | undefined =
            vscode.extensions.getExtension('amazonwebservices.aws-toolkit-vscode')
        assert.ok(extension)
        const testService = await extension!.activate()

        assert.strictEqual(testService.greeting, 'Hello, World!')
    })

    it('invokes the run code lens', async function() {
        this.timeout(TIMEOUT)

        const extension: vscode.Extension<TestService> | undefined =
            vscode.extensions.getExtension('amazonwebservices.aws-toolkit-vscode')
        assert.ok(extension)
        await extension!.activate()

        const folderPath = path.join('C:\\Users', 'pirocchi', 'Desktop', 'node', '10.x')
        const folderUri = vscode.Uri.file(folderPath)

        const result = vscode.workspace.updateWorkspaceFolders(0, 0, { uri: folderUri })
        assert.ok(result, `Could not add the folder ${folderUri.fsPath} to the workspace.`)
        const promise = new Promise<vscode.WorkspaceFoldersChangeEvent>((resolve, reject) => {
            vscode.workspace.onDidChangeWorkspaceFolders(resolve)
        })
        const event = await promise

        const documentPath = path.join(folderPath, 'app1', 'hello-world', 'app.js')
        const documentUri = vscode.Uri.file(documentPath)
        const codeLensesPromise = vscode.commands.executeCommand('vscode.executeCodeLensProvider', documentUri)
        const codeLenses = await codeLensesPromise
        assert.fail(String(codeLenses))
    })
})
