/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as immutable from 'immutable'
import * as redux from 'redux'

export type RegionsActionType =
    'FETCH_REGIONS_START' |
    'FETCH_REGIONS_SUCCESS' |
    'FETCH_REGIONS_FAILURE'

export type RegionActionType =
    'FETCH_REGION_START' |
    'FETCH_REGION_SUCCESS' |
    'FETCH_REGION_FAILURE'

export interface RegionsAction extends redux.Action<RegionsActionType> {
}

export interface FetchRegionsStart extends RegionsAction {

}

export interface FetchRegionsSuccess extends RegionsAction {
    regions: immutable.List<string>
}

export interface FetchRegionsFailure extends RegionsAction {
    message: string
}

export interface RegionAction extends redux.Action<RegionActionType> {
    region: string
}

export interface FetchRegionStart extends RegionAction {

}

export interface FetchRegionSuccess extends RegionAction {
    functions: immutable.List<string>
}

export interface FetchRegionFailure extends RegionAction {
    message: string
}
