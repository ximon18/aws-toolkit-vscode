/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as immutable from 'immutable'
import * as actions from '../../actions/lambda/functions'

export function functions(
    state: immutable.Map<string, any> = getInitialFunctionsState(),
    action: actions.FunctionsAction | actions.FunctionAction
) {
    switch (action.type) {
        case 'FETCH_FUNCTIONS_START':
            return state
                .setIn(['info', 'fetching'], true)
                .setIn(['info', 'fetchErrorMessage'], undefined)
        case 'FETCH_FUNCTIONS_SUCCESS':
            const successAction = action as actions.FetchFunctionsSuccess

            return state
                .setIn(['info', 'initialFetchComplete'], true)
                .setIn(['info', 'fetching'], false)
                .setIn(['info', 'fetchErrorMessage'], undefined)
                .set('functions', successAction.functions)
        case 'FETCH_FUNCTIONS_FAILURE':
            const failureAction = action as actions.FetchFunctionsFailure

            return state
                .setIn(['info', 'initialFetchComplete'], true)
                .setIn(['info', 'fetching'], false)
                .setIn(['info', 'fetchErrorMessage'], failureAction.message)
        case 'FETCH_FUNCTION_START':
        case 'FETCH_FUNCTION_SUCCESS':
        case 'FETCH_FUNCTION_FAILURE':
            const functionAction = action as actions.FunctionAction
            const keyPath = [ 'functions', functionAction.function ]

            return state.setIn(
                keyPath,
                _function(state.getIn(keyPath) as immutable.Map<string, any>, functionAction)
            )
        default:
            return state
    }
}

function getInitialFunctionsState(): immutable.Map<string, any> {
    return immutable.fromJS({
        info: {
            initialFetchComplete: false,
            fetching: false,
            fetchErrorMessage: undefined
        },
        functions: {}
    }) as immutable.Map<string, any>
}

function _function(
    state: immutable.Map<string, any> = getInitialFunctionState(),
    action: actions.FunctionAction
): immutable.Map<string, any> {
    switch (action.type) {
        case 'FETCH_FUNCTION_START':
            return state
                .setIn(['info', 'fetching'], true)
                .setIn(['info', 'fetchErrorMessage'], undefined)
        case 'FETCH_FUNCTION_SUCCESS':
            return state
                .setIn(['info', 'initialFetchComplete'], true)
                .setIn(['info', 'fetching'], false)
                .setIn(['info', 'fetchErrorMessage'], undefined)
        case 'FETCH_FUNCTION_FAILURE':
            const failureAction = action as actions.FetchFunctionFailure

            return state
                .setIn(['info', 'initialFetchComplete'], true)
                .setIn(['info', 'fetching'], false)
                .setIn(['info', 'fetchErrorMessage'], failureAction.message)
        default:
            return state
    }
}

function getInitialFunctionState(): immutable.Map<string, any> {
    return immutable.fromJS({
        info: {
            initialFetchComplete: false,
            fetching: false,
            fetchErrorMessage: undefined
        },
        functions: []
    }) as immutable.Map<string, any>
}
