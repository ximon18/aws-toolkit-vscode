/*!
 * Copyright 2018-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as assert from 'assert'
import * as path from 'path'
import * as vscode from 'vscode'
import { Datum } from '../shared/telemetry/telemetryTypes'
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
        this.timeout(TIMEOUT * 3)

        const extension: vscode.Extension<TestService> | undefined =
            vscode.extensions.getExtension('amazonwebservices.aws-toolkit-vscode')
        assert.ok(extension)
        await extension!.activate()

        const workspaceFolders = vscode.workspace.workspaceFolders
        assert.ok(workspaceFolders)
        assert.strictEqual(workspaceFolders!.length, 1)

        const folderUri = workspaceFolders![0].uri
        const documentPath = path.join(folderUri.fsPath, 'app1', 'hello-world', 'app.js')
        const documentUri = vscode.Uri.file(documentPath)
        const document = await vscode.workspace.openTextDocument(documentUri)

        const codeLensesPromise: Thenable<vscode.CodeLens[] | undefined> =
            vscode.commands.executeCommand('vscode.executeCodeLensProvider', document.uri)
        const codeLenses = await codeLensesPromise
        assert.ok(codeLenses)
        assert.strictEqual(codeLenses!.length, 3)

        const [ runCodeLens, debugCodeLens, configureCodeLens ] = codeLenses!

        assert.ok(runCodeLens.command)
        const command = runCodeLens.command!
        assert.ok(command.arguments)
        const runResult: { datum: Datum } | undefined = await vscode.commands.executeCommand(
            command.command,
            command.arguments!
        )

        assert.ok(runResult)
        const { datum } = runResult!
        assert.strictEqual(datum.name, 'invokelocal')
        assert.strictEqual(datum.value, 1)
        assert.strictEqual(datum.unit, 'Count')

        assert.ok(datum.metadata)
        const metadata = datum.metadata!
        assert.strictEqual(metadata.get('runtime'), 'nodejs10.x')
        assert.strictEqual(metadata.get('debug'), 'false')
    })
})
