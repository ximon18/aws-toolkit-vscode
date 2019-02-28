/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as semver from 'semver'
import { DefaultSamCliInvoker, SamCliInvoker } from './index'

export enum SamCliVersionValidation {
    Valid = 'Valid',
    VersionTooLow = 'VersionTooLow',
    VersionTooHigh = 'VersionTooHigh',
    VersionNotParseable = 'VersionNotParseable',
}

export class SamCliVersion {

    public static readonly MINIMUM_SAM_CLI_VERSION_INCLUSIVE = '0.7.0'
    public static readonly MAXIMUM_SAM_CLI_VERSION_EXCLUSIVE = '0.16.0'

    public static validate(version?: string): SamCliVersionValidation {
        if (!version) {
            return SamCliVersionValidation.VersionNotParseable
        }

        if (!semver.valid(version)) {
            return SamCliVersionValidation.VersionNotParseable
        }

        if (semver.lt(version, this.MINIMUM_SAM_CLI_VERSION_INCLUSIVE)) {
            return SamCliVersionValidation.VersionTooLow
        }

        if (semver.gte(version, this.MAXIMUM_SAM_CLI_VERSION_EXCLUSIVE)) {
            return SamCliVersionValidation.VersionTooHigh
        }

        return SamCliVersionValidation.Valid
    }

}

export interface SamCliVersionProvider {
    getSamCliVersion(): Promise<string>
}

export class DefaultSamCliVersionProvider implements SamCliVersionProvider {
    public constructor(
        private readonly invoker: SamCliInvoker = new DefaultSamCliInvoker()
    ) {
    }

    public async getSamCliVersion(): Promise<string> {
        return (await this.invoker.info()).version
    }
}
