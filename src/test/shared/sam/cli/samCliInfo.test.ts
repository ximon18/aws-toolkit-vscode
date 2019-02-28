/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as assert from 'assert'
import { SpawnOptions } from 'child_process'
import { DefaultSamCliInvoker, SamCliInvoker, SamCliProcessInvoker } from '../../../../shared/sam/cli'
import { ChildProcessResult } from '../../../../shared/utilities/childProcess'

describe('SamCliInfoCommand', async () => {
    class TestProcessInvoker implements SamCliProcessInvoker {
        private readonly _result: ChildProcessResult

        public constructor(result: Partial<ChildProcessResult>) {
            this._result = {
                error: result.error || undefined,
                exitCode: result.exitCode || 0,
                stderr: result.stderr || '',
                stdout: result.stdout || ''
            }
        }

        public invoke(options: SpawnOptions, ...args: string[]): Promise<ChildProcessResult>
        public invoke(...args: string[]): Promise<ChildProcessResult>
        public async invoke(first: SpawnOptions | string, ...rest: string[]): Promise<ChildProcessResult> {
            return this._result
        }
    }
    it('converts sam info response to SamCliInfoResponse', async () => {
        const invoker: SamCliInvoker = new DefaultSamCliInvoker(
            new TestProcessInvoker({
                stdout: '{"version": "1.2.3"}'
            })
        )
        const response = await invoker.info()

        assert.ok(response)
        assert.strictEqual(response!.version, '1.2.3')
    })

    it('converts sam info response without version to SamCliInfoResponse', async () => {
        const invoker: SamCliInvoker = new DefaultSamCliInvoker(
            new TestProcessInvoker({
                stdout: '{}'
            })
        )
        const response = await invoker.info()

        assert.ok(response)
        assert.strictEqual(response!.version, undefined)
    })

    it('converts non-response to undefined', async () => {
        const rawResponses = [
            'qwerty',
            '{"version": "1.2.3"} you have no new email messages'
        ]

        for (const rawResponse of rawResponses) {
            const invoker: SamCliInvoker = new DefaultSamCliInvoker(
                new TestProcessInvoker({
                    stdout: rawResponse
                })
            )
            const response = await invoker.info()

            assert.strictEqual(response, undefined, `Expected text to not parse: ${rawResponse}`)
        }
    })
})
