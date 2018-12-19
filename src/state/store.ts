/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as immutable from 'immutable'
import * as redux from 'redux'
import { createEpicMiddleware } from 'redux-observable'
import { ToolkitAction } from './actions'
import { rootReducer } from './reducers'

export interface ToolkitState {
    functions?: immutable.Map<string, any>
    regions?: immutable.Map<string, any>
}

export interface ToolkitStore extends redux.Store<ToolkitState, ToolkitAction> {
}

export function configureStore(initialState: ToolkitState = {
    functions: undefined,
    regions: undefined
}): ToolkitStore {
    const middleware = createEpicMiddleware<ToolkitAction, ToolkitAction, ToolkitState>()

    return redux.createStore(
        rootReducer,
        initialState,
        redux.applyMiddleware(middleware)
    )
}
