import { RendererCompiler } from '../../../src/compilers/renderer-compiler'
import { Component, defineComponent } from 'san'
import { ComponentClassParser } from '../../../src/parsers/component-class-parser'
import {
    AssignmentStatement,
    SlotRendererDefinition,
    SyntaxKind,
    FunctionDefinition,
    FunctionCall,
    UnaryExpression
} from '../../../src/ast/renderer-ast-dfn'
import { matchHTMLAddEqual } from '../../stub/util'

describe('compilers/renderer-compiler', () => {
    describe('#compileToRenderer()', () => {
        it('should compile a single div renderer', () => {
            const ComponentClass = defineComponent({
                template: '<div></div>',
                foo: [1, x => x]
            })
            const sourceFile = new ComponentClassParser(ComponentClass as any as Component, '/tmp/foo.js').parse()
            const compiler = new RendererCompiler({})
            const body = [...(compiler.compileToRenderer(sourceFile.componentInfos[0]) as FunctionDefinition).body]
            expect(body.pop()).toEqual(expect.objectContaining({
                kind: SyntaxKind.ReturnStatement,
                value: {
                    name: 'html',
                    kind: SyntaxKind.Identifier
                }
            }))
            expect(body.pop()).toEqual(matchHTMLAddEqual({
                value: '</div>',
                kind: SyntaxKind.Literal
            }))
        })
        it('should emit slot comment', () => {
            const ComponentClass = defineComponent({
                components: {
                    ccc: defineComponent({ template: '<div><slot/></div>' })
                },
                template: '<ccc><span></span>   \nassa</ccc>'
            })
            const sourceFile = new ComponentClassParser(ComponentClass as any as Component, '/tmp/foo.js').parse()
            const compiler = new RendererCompiler({})
            const compileRes = compiler.compileToRenderer(sourceFile.componentInfos[0])
            const body = [
                ...((((compileRes as FunctionCall).fn as UnaryExpression).value as FunctionDefinition).body)
            ]

            const assignmentNode = body.find(item =>
                item.kind === SyntaxKind.AssignmentStatement &&
                item.rhs.kind === SyntaxKind.SlotRendererDefinition
            ) as AssignmentStatement
            expect(assignmentNode).toBeTruthy()
            const SlotRendererDefinitionNode = assignmentNode.rhs as SlotRendererDefinition
            expect([...SlotRendererDefinitionNode.body].find(item => {
                return item.kind === SyntaxKind.ExpressionStatement &&
                    item.value.kind === SyntaxKind.BinaryExpression &&
                    item.value.rhs.kind === SyntaxKind.Literal &&
                    item.value.rhs.value.indexOf('s-slot') !== -1
            })).toBeTruthy()
        })
        it('should emit slot comment(with filter)', () => {
            const ComponentClass = defineComponent({
                components: {
                    ccc: defineComponent({ template: '<div><slot/></div>' })
                },
                template: '<ccc>{{   \nassa | aaa | bbb}}<div></div></ccc>'
            })
            const sourceFile = new ComponentClassParser(ComponentClass as any as Component, '/tmp/foo.js').parse()
            const compiler = new RendererCompiler({})
            const compileRes = compiler.compileToRenderer(sourceFile.componentInfos[0])
            const body = [
                ...((((compileRes as FunctionCall).fn as UnaryExpression).value as FunctionDefinition).body)
            ]

            const assignmentNode = body.find(item =>
                item.kind === SyntaxKind.AssignmentStatement &&
                item.rhs.kind === SyntaxKind.SlotRendererDefinition
            ) as AssignmentStatement
            expect(assignmentNode).toBeTruthy()
            const SlotRendererDefinitionNode = assignmentNode.rhs as SlotRendererDefinition
            expect([...SlotRendererDefinitionNode.body].find(item => {
                return item.kind === SyntaxKind.ExpressionStatement &&
                    item.value.kind === SyntaxKind.BinaryExpression &&
                    item.value.rhs.kind === SyntaxKind.Literal &&
                    item.value.rhs.value.indexOf('s-slot') !== -1
            })).toBeTruthy()
        })
        it('should emit slot comment(with filter2)', () => {
            const ComponentClass = defineComponent({
                components: {
                    ccc: defineComponent({ template: '<div><slot/></div>' })
                },
                template: '<ccc><div></div>{{   \nassa | aaa | bbb}}</ccc>'
            })
            const sourceFile = new ComponentClassParser(ComponentClass, '/tmp/foo.js').parse()
            const compiler = new RendererCompiler({})
            const compileRes = compiler.compileToRenderer(sourceFile.componentInfos[0])
            const body = [
                ...((((compileRes as FunctionCall).fn as UnaryExpression).value as FunctionDefinition).body)
            ]

            const assignmentNode = body.find(item =>
                item.kind === SyntaxKind.AssignmentStatement &&
                item.rhs.kind === SyntaxKind.SlotRendererDefinition
            ) as AssignmentStatement
            expect(assignmentNode).toBeTruthy()
            const SlotRendererDefinitionNode = assignmentNode.rhs as SlotRendererDefinition
            expect([...SlotRendererDefinitionNode.body].find(item => {
                return item.kind === SyntaxKind.ExpressionStatement &&
                    item.value.kind === SyntaxKind.BinaryExpression &&
                    item.value.rhs.kind === SyntaxKind.Literal &&
                    item.value.rhs.value.indexOf('s-slot') !== -1
            })).toBeTruthy()
        })
    })
})
