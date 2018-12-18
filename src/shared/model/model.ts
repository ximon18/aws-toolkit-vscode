/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

export interface ServiceModel {
    name: string
}

export interface RootModel {
    [service: string]: ServiceModel
}
