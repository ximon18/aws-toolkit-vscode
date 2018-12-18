/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import { ServiceModel } from '../../shared/model/model'

interface LambdaFunction {

}

interface LambdaRegion {
    [lambdaFunction: string]: LambdaFunction
}

interface LambdaModel extends ServiceModel {
    regions: {
        [region: string]: LambdaRegion
    }
}
