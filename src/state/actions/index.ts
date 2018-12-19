/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import {
    FunctionAction,
    FunctionActionType,
    FunctionsAction,
    FunctionsActionType
} from './lambda/functions'
import {
    RegionAction,
    RegionActionType,
    RegionsAction,
    RegionsActionType
} from './lambda/regions'

export type ToolkitAction =
    FunctionAction |
    FunctionsAction |
    RegionAction |
    RegionsAction

export type ToolkitActionType =
    FunctionActionType |
    FunctionsActionType |
    RegionActionType |
    RegionsActionType
