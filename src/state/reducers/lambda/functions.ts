/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as immutable from 'immutable'
// import * as redux from 'redux'
import * as actions from '../../actions/lambda/actions'

export function lambda(state: immutable.Map<string, any> = getInitialLambdaState(), action: actions.LambdaAction) {
    switch (action.type) {
        case 'FETCH_REGIONS_START':
            return state
                .setIn([ 'info', 'fetching' ], true)
                .setIn([ 'info', 'errorMessage' ], undefined)

        case 'FETCH_REGIONS_SUCCESS':
            const successAction = action as actions.FetchRegionsSuccess

            state = state
                .setIn([ 'info', 'fetching' ], false)
                .setIn([ 'info', 'initialFetchComplete' ], true)
                .setIn([ 'info', 'errorMessage' ], undefined)

            for (const regionName of successAction.regions) {
                const keyPath = ['regions', regionName]
                state = state.setIn(keyPath, region(state.getIn(keyPath) as immutable.Map<string, any>, action))
            }

            for (const regionName of (state.get('regions') as immutable.Map<string, any>).keySeq()) {
                if (!(regionName in successAction.regions)) {
                    state = state.deleteIn([ 'regions', 'regionName' ])
                }
            }

            return state

        case 'FETCH_REGIONS_FAILURE':
            const failureAction = action as actions.FetchRegionsFailure

            return state
                .setIn([ 'info', 'fetching' ], false)
                .setIn([ 'info', 'initialFetchComplete' ], true)
                .setIn([ 'info', 'errorMessage' ], failureAction.message)

        default:
            return state
    }
}

function getInitialLambdaState(): immutable.Map<string, any> {
    return immutable.fromJS({
        info: {
            initialFetchComplete: false,
            fetching: false,
            errorMessage: undefined
        },
        regions: {}
    }) as immutable.Map<string, any>
}

function region(state: immutable.Map<string, any> = getInitialRegionState(), action: LambdaAction) {
    switch (action.type) {
        default:
            return state
    }
}

function getInitialRegionState(): immutable.Map<string, any> {
    return immutable.fromJS({
        functions: {}
    }) as immutable.Map<string, any>
}

function lambdaFunction(state: immutable.Map<string, any> = getInitialFunctionState(), action: LambdaAction) {
    switch (action.type) {
        default:
            return state
    }
}

function getInitialFunctionState(): immutable.Map<string, any> {
    return immutable.fromJS({
        name: undefined
    }) as immutable.Map<string, any>
}
