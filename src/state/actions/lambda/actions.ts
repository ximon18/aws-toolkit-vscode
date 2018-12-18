/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as redux from 'redux'

export type LambdaActionType =
    'FETCH_REGIONS_START' |
    'FETCH_REGIONS_SUCCESS' |
    'FETCH_REGIONS_FAILURE' |
    RegionActionType |
    FunctionActionType

export interface LambdaAction extends redux.Action<LambdaActionType> {
}

export interface FetchRegionsStart extends LambdaAction {
    type: 'FETCH_REGIONS_START'
}

export interface FetchRegionsSuccess extends LambdaAction {
    type: 'FETCH_REGIONS_SUCCESS'
    regions: string[]
}

export interface FetchRegionsFailure extends LambdaAction {
    type: 'FETCH_REGIONS_FAILURE',
    message: string
}

type RegionActionType =
    '3' |
    '4'

export interface RegionAction extends redux.Action<RegionActionType> {
}

type FunctionActionType =
    '5' |
    '6'

export interface FunctionAction extends redux.Action<FunctionActionType> {
}
