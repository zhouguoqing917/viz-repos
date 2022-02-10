/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Container, interfaces } from 'inversify';
import { defaultTreeProps, TreeProps, TreeWidget } from "./tree-widget";
import { ITreeModel, TreeModel, TreeServices } from "./tree-model";
import { ITree, Tree } from "./tree";
import { ITreeSelectionService, TreeSelectionService } from "./tree-selection";
import { ITreeExpansionService, TreeExpansionService } from "./tree-expansion";
import { TreeNavigationService } from './tree-navigation';

export function createTreeContainer(parent: interfaces.Container): Container {
    const child = new Container({ defaultScope: 'Singleton' });
    child.parent = parent;

    child.bind(Tree).toSelf();
    child.bind(ITree).toDynamicValue(ctx => ctx.container.get(Tree));

    child.bind(TreeSelectionService).toSelf();
    child.bind(ITreeSelectionService).toDynamicValue(ctx => ctx.container.get(TreeSelectionService));

    child.bind(TreeExpansionService).toSelf();
    child.bind(ITreeExpansionService).toDynamicValue(ctx => ctx.container.get(TreeExpansionService));

    child.bind(TreeNavigationService).toSelf();
    child.bind(TreeServices).toSelf();

    child.bind(TreeModel).toSelf();
    child.bind(ITreeModel).toDynamicValue(ctx => ctx.container.get(TreeModel));

    child.bind(TreeWidget).toSelf();
    child.bind(TreeProps).toConstantValue(defaultTreeProps);

    return child;
}