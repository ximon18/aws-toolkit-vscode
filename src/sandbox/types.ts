/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as vscode from 'vscode'

interface SignatureBase<TParameters, TResult> {
    (parameters: TParameters): Promise<TResult>
}

export namespace Search {
    export interface Parameters {
        sourceDocumentUri: vscode.Uri
    }

    export interface Result {
        sourceShortHandlerNames: string[]
    }

    export type Signature = SignatureBase<Parameters, Result>
}

export namespace Resolve {
    export interface Parameters {
        sourceDocumentUri: vscode.Uri
        sourceShortHandlerName: string
    }

    export interface Result {
        sourceTemplateUri: vscode.Uri
        sourceFullHandlerName: string
    }

    export type Signature = SignatureBase<Parameters, Result>
}

export namespace Build {
    export interface Parameters {
        sourceTemplateUri: vscode.Uri
        sourceFullHandlerName: string
    }

    export interface Result {
        // For non-python runtimes, this will have the same value as sourceTemplateUri.
        invokeTemplateUri: vscode.Uri
        // For non-python runtimes, this will have the same value as sourceFullHandlerName.
        invokeFullHandlerName: string
    }

    export type Signature = SignatureBase<Parameters, Result>
}

export namespace Invoke {
    // The ResolveResult is required to fetch event/env var overrides from templates.json.
    export interface Parameters extends Resolve.Result {
        invokeTemplateUri: vscode.Uri
        invokeFullHandlerName: string
    }

    export interface Result {
    }

    export type Signature = SignatureBase<Parameters, Result>
}

export namespace Package {
    export interface Parameters {
        sourceTemplateUri: vscode.Uri
        s3Bucket: string
        profile: string
    }

    export interface Result {
        packagedTemplateUri: vscode.Uri
    }

    export type Signature = SignatureBase<Parameters, Result>
}

export namespace Deploy {
    export interface Parameters {
        packagedTemplateUri: vscode.Uri
        stackName: string
        region: string
        profile: string
    }

    export interface Result {
    }

    export type Signature = SignatureBase<Parameters, Result>
}
