/**
 * 把组件（ComponentInfo）编译成 renderer 函数（render AST 形式）
 *
 * 每个 ComponentInfo 对应于一个 San 组件定义，对应一个 SSR 的 renderer 函数。
 * 这个函数接受数据，返回 HTML。
 */
import { ANodeCompiler } from './anode-compiler'
import { ComponentInfo } from '../models/component-info'
import { RenderOptions } from './renderer-options'
import {
    FunctionDefinition, ComputedCall, Foreach, FunctionCall, MapLiteral, If, CreateComponentInstance, ImportHelper,
    ComponentReferenceLiteral, ConditionalExpression, BinaryExpression, CreateComponentPrototype, Else
} from '../ast/renderer-ast-dfn'
import {
    EMPTY_MAP, STATEMENT, NEW, BINARY, ASSIGN, DEF, RETURN, createDefaultValue, L, I, NULL, UNDEFINED,
    createTryStatement, createDefineWithDefaultValue
} from '../ast/renderer-ast-util'
import { IDGenerator } from '../utils/id-generator'
import { mergeLiteralAdd } from '../optimizers/merge-literal-add'

/**
 * 每个 ComponentClass 对应一个 Render 函数，由 RendererCompiler 生成。
 */
export class RendererCompiler {
    private id = new IDGenerator()

    constructor (
        private options: RenderOptions
    ) {}

    /**
     * 把 ComponentInfo 编译成函数源码，返回 Renderer 函数的 AST
     */
    public compileToRenderer (componentInfo: ComponentInfo) {
        const args = [
            DEF('data'),

            // 参数太多了，后续要增加的参数统一收敛到这里
            DEF('...info')
        ]
        const fn = new FunctionDefinition(this.options.functionName || '', args,
            componentInfo.componentType === 'template'
                ? this.compileTemplateComponentRendererBody(componentInfo)
                : this.compileComponentRendererBody(componentInfo)
        )
        mergeLiteralAdd(fn)
        return fn
    }

    private compileComponentRendererBody (info: ComponentInfo) {
        const body = []
        // 没有 ANode 的组件，比如 load-success 样例
        if (!info.root) {
            body.push(RETURN(L('')))
            return body
        }

        // 兼容多参数的情况
        body.push(new If(
            new BinaryExpression(
                BINARY(I('info'), '.', I('length')),
                '===',
                L(1)
            ),
            [ASSIGN(I('info'), BINARY(
                BINARY(I('info'), '[]', L(0)),
                '||',
                L({})
            ))]
        ))
        body.push(new Else([
            ASSIGN(I('info'), new MapLiteral([
                [I('noDataOutput'), BINARY(I('info'), '[]', L(1))],
                [I('parentCtx'), BINARY(I('info'), '[]', L(2))],
                [I('tagName'), BINARY(I('info'), '[]', L(3))],
                [I('slots'), BINARY(I('info'), '[]', L(4))]
            ]))
        ]))

        // get params from info
        body.push(createDefineWithDefaultValue('noDataOutput', BINARY(I('info'), '.', I('noDataOutput')), L(false)))
        body.push(createDefineWithDefaultValue('parentCtx', BINARY(I('info'), '.', I('parentCtx')), NULL))
        body.push(createDefineWithDefaultValue('tagName', BINARY(I('info'), '.', I('tagName')), L('div')))
        body.push(createDefineWithDefaultValue('slots', BINARY(I('info'), '.', I('slots')), EMPTY_MAP))

        // helper
        body.push(new ImportHelper('_'))
        body.push(new ImportHelper('SanSSRData'))

        if (this.options.useProvidedComponentClass) {
            body.push(STATEMENT(new CreateComponentPrototype(info)))
        }

        // context
        body.push(this.compileGenInstance(info))
        body.push(...this.compileContext(info))

        // instance preraration
        if (info.hasMethod('initData')) {
            body.push(...this.emitInitData())
        }

        // call inited
        if (info.hasMethod('inited')) {
            body.push(createTryStatement(
                [STATEMENT(new FunctionCall(BINARY(I('instance'), '.', I('inited')), []))],
                I('e'),
                [STATEMENT(new FunctionCall(BINARY(I('_'), '.', I('handleError')), [
                    I('e'),
                    I('instance'),
                    L('hook:inited')
                ]))]
            ))
        }

        // calc computed
        for (const name of info.getComputedNames()) {
            body.push(ASSIGN(BINARY(I('data'), '[]', L(name)), new ComputedCall(name)))
        }

        body.push(ASSIGN(
            BINARY(I('instance'), '.', BINARY(I('lifeCycle'), '.', I('inited'))),
            I('true')
        ))

        body.push(DEF('html', L('')))
        body.push(ASSIGN(I('parentCtx'), I('ctx')))
        const aNodeCompiler = new ANodeCompiler(
            info, !!this.options.ssrOnly, this.id, this.options.useProvidedComponentClass
        )
        body.push(...aNodeCompiler.compile(info.root, true))

        body.push(RETURN(I('html')))
        return body
    }

    private compileTemplateComponentRendererBody (info: ComponentInfo) {
        const body = []
        // 没有 ANode 的组件，比如 load-success 样例
        if (!info.root) {
            body.push(RETURN(L('')))
            return body
        }

        // 兼容多参数的情况
        body.push(new If(
            new BinaryExpression(
                BINARY(I('info'), '.', I('length')),
                '===',
                L(1)
            ),
            [ASSIGN(I('info'), BINARY(
                BINARY(I('info'), '[]', L(0)),
                '||',
                L({})
            ))]
        ))
        body.push(new Else([
            ASSIGN(I('info'), new MapLiteral([
                [I('noDataOutput'), BINARY(I('info'), '[]', L(1))],
                [I('parentCtx'), BINARY(I('info'), '[]', L(2))],
                [I('slots'), BINARY(I('info'), '[]', L(4))]
            ]))
        ]))

        // get params from info
        body.push(createDefineWithDefaultValue('noDataOutput', BINARY(I('info'), '.', I('noDataOutput')), L(false)))
        body.push(createDefineWithDefaultValue('parentCtx', BINARY(I('info'), '.', I('parentCtx')), NULL))
        body.push(createDefineWithDefaultValue('slots', BINARY(I('info'), '.', I('slots')), EMPTY_MAP))

        // helper
        body.push(new ImportHelper('_'))

        // instance preraration
        if (info.hasMethod('initData')) {
            if (this.options.useProvidedComponentClass) {
                body.push(STATEMENT(new CreateComponentPrototype(info)))
            }
            // context
            body.push(DEF('instance', new CreateComponentInstance(info)))
            body.push(...this.compileTemplateComponentContext())
            body.push(...this.emitInitData())
        } else {
            body.push(DEF('instance', I('{}')))
            body.push(...this.compileTemplateComponentContext())
        }

        body.push(DEF('html', L('')))
        body.push(ASSIGN(I('parentCtx'), I('ctx')))
        const aNodeCompiler = new ANodeCompiler(
            info, !!this.options.ssrOnly, this.id, this.options.useProvidedComponentClass
        )
        body.push(...aNodeCompiler.compile(info.root, true))

        body.push(RETURN(I('html')))
        return body
    }

    private compileGenInstance (info: ComponentInfo) {
        return DEF('instance', new CreateComponentInstance(info))
    }

    private compileContext (info: ComponentInfo) {
        const refs = info.hasDynamicComponent()
            ? new MapLiteral(
                [...info.childComponents.entries()]
                    .map(([key, val]) => [L(key), new ComponentReferenceLiteral(val)])
            )
            : EMPTY_MAP
        return [
            ASSIGN(
                BINARY(I('instance'), '.', I('data')),
                NEW(I('SanSSRData'), [I('data'), I('instance')])
            ),
            ASSIGN(
                BINARY(I('instance'), '.', I('sourceSlots')),
                new FunctionCall(
                    BINARY(I('_'), '.', I('mergeChildSlots')),
                    [I('slots')]
                )
            ),
            ASSIGN(
                BINARY(I('instance'), '.', I('lifeCycle')),
                new MapLiteral([
                    [I('compiled'), I('true')],
                    [I('inited'), I('false')]
                ])
            ),
            new If(
                I('parentCtx'), [ASSIGN(
                    BINARY(I('instance'), '.', I('parentComponent')),
                    BINARY(I('parentCtx'), '.', I('instance'))
                )]
            ),
            DEF('refs', refs),

            // 组件级别的 context
            DEF('ctx', new MapLiteral([
                I('instance'),
                I('slots'),
                I('data'),
                I('parentCtx'),
                I('refs'),

                // 单次渲染级别的 context
                // 从最外层一直传下来的，上面可以绑 customRequirePath 等方法
                [I('context'), BINARY(I('parentCtx'), '&&', BINARY(I('parentCtx'), '.', I('context')))]
            ]))
        ]
    }

    private compileTemplateComponentContext () {
        return [
            ASSIGN(
                BINARY(I('instance'), '.', I('sourceSlots')),
                new FunctionCall(
                    BINARY(I('_'), '.', I('mergeChildSlots')),
                    [I('slots')]
                )
            ),
            DEF('ctx', new MapLiteral([
                I('instance'),
                I('slots'),
                I('data'),
                I('parentCtx')
            ]))
        ]
    }

    /**
     * 产出 initData() 的函数调用
     *
     * 注意即使对于 JSComponentInfo，也不能在编译期调用 initData。
     * 因为字面量是无法表示嵌套关系的，详细讨论见：
     * https://github.com/baidu/san-ssr/issues/99
     */
    private emitInitData () {
        const item = BINARY(BINARY(I('ctx'), '.', I('data')), '[]', I('key'))

        return [
            DEF('initData', undefined),
            createTryStatement(
                [ASSIGN(I('initData'), new FunctionCall(BINARY(I('instance'), '.', I('initData')), []))],
                I('e'),
                [STATEMENT(new FunctionCall(BINARY(I('_'), '.', I('handleError')), [
                    I('e'),
                    I('instance'),
                    L('initData')
                ]))]
            ),
            createDefaultValue(I('initData'), new MapLiteral([])),
            new Foreach(I('key'), I('value'), I('initData'), [
                ASSIGN(item, new ConditionalExpression(BINARY(item, '!==', UNDEFINED), item, I('value')))
            ])
        ]
    }
}
