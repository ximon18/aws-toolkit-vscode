/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as immutable from 'immutable'
import * as redux from 'redux'
import { ToolkitAction } from './actions'
import { rootReducer } from './reducers'

export interface ToolkitStore extends redux.Store<immutable.Map<string, any>, ToolkitAction> {
}

export function createStore(): ToolkitStore {
    return redux.createStore(rootReducer)
}
