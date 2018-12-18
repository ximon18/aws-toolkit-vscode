/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as redux from 'redux'
import { LambdaActionType } from './lambda/actions'

type ActionType = LambdaActionType

export interface ToolkitAction<T> extends redux.Action<ActionType> {

}
