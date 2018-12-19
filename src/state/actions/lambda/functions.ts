/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as immutable from 'immutable'
import * as redux from 'redux'

type FETCH_FUNCTIONS_START = 'FETCH_FUNCTIONS_START'
type FETCH_FUNCTIONS_SUCCESS = 'FETCH_FUNCTIONS_SUCCESS'
type FETCH_FUNCTIONS_FAILURE = 'FETCH_FUNCTIONS_FAILURE'
type FETCH_FUNCTION_START = 'FETCH_FUNCTIONS_START'
type FETCH_FUNCTION_SUCCESS = 'FETCH_FUNCTIONS_SUCCESS'
type FETCH_FUNCTION_FAILURE = 'FETCH_FUNCTIONS_FAILURE'

export type FunctionsActionType =
    FETCH_FUNCTIONS_START |
    FETCH_FUNCTIONS_SUCCESS |
    FETCH_FUNCTIONS_FAILURE

export type FunctionActionType =
    FETCH_FUNCTION_START |
    FETCH_FUNCTION_SUCCESS |
    FETCH_FUNCTION_FAILURE

export interface FunctionsAction extends redux.Action<FunctionsActionType> {
}

export interface FetchFunctionsStart extends FunctionsAction {
    type: FETCH_FUNCTIONS_START
}

export interface FetchFunctionsSuccess extends FunctionsAction {
    type: FETCH_FUNCTIONS_SUCCESS
    functions: immutable.List<string>
}

export interface FetchFunctionsFailure extends FunctionsAction {
    type: FETCH_FUNCTIONS_FAILURE
    message: string
}

export interface FunctionAction extends redux.Action<FunctionActionType> {
    functionName: string
}

export interface FetchFunctionStart extends FunctionAction {
    type: FETCH_FUNCTION_START

}

export interface FetchFunctionSuccess extends FunctionAction {
    type: FETCH_FUNCTION_SUCCESS
}

export interface FetchFunctionFailure extends FunctionAction {
    type: FETCH_FUNCTION_FAILURE
    message: string
}

export function fetchFunctionsStart(): FetchFunctionsStart {
    return {
        type: 'FETCH_FUNCTIONS_START'
    }
}

export function fetchFunctionsSuccess(functions: string[]): FetchFunctionsSuccess {
    return {
        type: 'FETCH_FUNCTIONS_SUCCESS',
        functions: immutable.fromJS(functions) as immutable.List<string>
    }
}

export function fetchFunctionsFailure(message: string): FetchFunctionsFailure {
    return {
        type: 'FETCH_FUNCTIONS_FAILURE',
        message
    }
}

export function fetchFunctionStart(functionName: string): FetchFunctionStart {
    return {
        type: 'FETCH_FUNCTIONS_START',
        functionName
    }
}

export function fetchFunctionSuccess(functionName: string): FetchFunctionSuccess {
    return {
        type: 'FETCH_FUNCTIONS_SUCCESS',
        functionName
    }
}

export function fetchFunctionFailure(functionName: string, message: string): FetchFunctionFailure {
    return {
        type: 'FETCH_FUNCTIONS_FAILURE',
        functionName,
        message
    }
}
