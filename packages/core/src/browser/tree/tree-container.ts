import { Container, interfaces } from 'inversify';
import { defaultTreeProps, TreeProps, TreeWidget } from "./tree-widget";
import { TreeModel, TreeModelImpl } from "./tree-model";
import { Tree, TreeImpl } from "./tree";
import { TreeSelectionService } from "./tree-selection";
import { TreeSelectionServiceImpl } from './tree-selection-impl';
import { TreeExpansionService, TreeExpansionServiceImpl } from "./tree-expansion";
import { TreeNavigationService } from './tree-navigation';
import { NoopTreeDecoratorService, TreeDecoratorService } from './tree-decorator';

export function createTreeContainer(parent: interfaces.Container): Container {
    const child = new Container({ defaultScope: 'Singleton' });
    child.parent = parent;

    child.bind(TreeImpl).toSelf();
    child.bind(Tree).toDynamicValue(ctx => ctx.container.get(TreeImpl));

    child.bind(TreeSelectionServiceImpl).toSelf();
    child.bind(TreeSelectionService).toDynamicValue(ctx => ctx.container.get(TreeSelectionServiceImpl));

    child.bind(TreeExpansionServiceImpl).toSelf();
    child.bind(TreeExpansionService).toDynamicValue(ctx => ctx.container.get(TreeExpansionServiceImpl));

    child.bind(TreeNavigationService).toSelf();

    child.bind(TreeModelImpl).toSelf();
    child.bind(TreeModel).toDynamicValue(ctx => ctx.container.get(TreeModelImpl));

    child.bind(TreeWidget).toSelf();
    child.bind(TreeProps).toConstantValue(defaultTreeProps);

    child.bind(TreeDecoratorService).to(NoopTreeDecoratorService).inSingletonScope();
    return child;
}
