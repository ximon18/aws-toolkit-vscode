/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import { combineReducers } from 'redux'
import { functions } from './lambda/functions'
import { regions } from './lambda/regions'

export const rootReducer = combineReducers({
    functions,
    regions
})
