/**
 * Reading a ```bpmn fence (plan step 14).
 *
 * One process the way Camunda's modeller writes it — a pool with two lanes, a
 * message start, a user task, a gateway with a default and a conditional
 * path, a service task, a task with a timer on its edge, an annotation, a
 * data object, and a second, collapsed pool sending a message — and what is
 * pinned is that every one of those comes out as the shape it is, where the
 * file put it, with the refusals a document can meet said as keys.
 */
import { describe, expect, it } from 'vitest'
import { readBpmn, readXml, wrapLabel } from './bpmn'

export const ORDER_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="defs">
  <!-- the collaboration: who takes part -->
  <bpmn:collaboration id="collab">
    <bpmn:participant id="acme" name="Acme Logistics" processRef="handle" />
    <bpmn:participant id="customer" name="Customer" />
    <bpmn:messageFlow id="mf1" sourceRef="customer" targetRef="start" name="order" />
  </bpmn:collaboration>
  <bpmn:process id="handle" isExecutable="false">
    <bpmn:laneSet id="lanes">
      <bpmn:lane id="sales" name="Sales"><bpmn:flowNodeRef>start</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="ops" name="Operations" />
    </bpmn:laneSet>
    <bpmn:startEvent id="start" name="Order received"><bpmn:messageEventDefinition id="m1" /></bpmn:startEvent>
    <bpmn:userTask id="check" name="Check the order &amp; the customer" />
    <bpmn:exclusiveGateway id="gw" name="In stock?" default="yes" />
    <bpmn:serviceTask id="reserve" name="Reserve the stock" />
    <bpmn:userTask id="ask" name="Ask the supplier" />
    <bpmn:boundaryEvent id="late" attachedToRef="ask"><bpmn:timerEventDefinition id="t1" /></bpmn:boundaryEvent>
    <bpmn:endEvent id="end" name="Order confirmed" />
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="check" />
    <bpmn:sequenceFlow id="f2" sourceRef="check" targetRef="gw" />
    <bpmn:sequenceFlow id="yes" sourceRef="gw" targetRef="reserve" name="yes" />
    <bpmn:sequenceFlow id="no" sourceRef="gw" targetRef="ask" name="no">
      <bpmn:conditionExpression><![CDATA[\${stock < ordered}]]></bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f5" sourceRef="reserve" targetRef="end" />
    <bpmn:dataObjectReference id="orderRef" name="Order" dataObjectRef="orderData" />
    <bpmn:dataObject id="orderData" />
    <bpmn:textAnnotation id="note"><bpmn:text>Within one working day</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="a1" sourceRef="note" targetRef="check" />
    <bpmn:dataInputAssociation id="da1"><bpmn:sourceRef>orderRef</bpmn:sourceRef></bpmn:dataInputAssociation>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram">
    <bpmndi:BPMNPlane id="plane" bpmnElement="collab">
      <bpmndi:BPMNShape id="acme_di" bpmnElement="acme" isHorizontal="true"><dc:Bounds x="100" y="100" width="700" height="300" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sales_di" bpmnElement="sales" isHorizontal="true"><dc:Bounds x="130" y="100" width="670" height="150" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ops_di" bpmnElement="ops" isHorizontal="true"><dc:Bounds x="130" y="250" width="670" height="150" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="customer_di" bpmnElement="customer" isHorizontal="true"><dc:Bounds x="100" y="20" width="700" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="172" y="157" width="36" height="36" /><bpmndi:BPMNLabel><dc:Bounds x="150" y="200" width="80" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="check_di" bpmnElement="check"><dc:Bounds x="260" y="135" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_di" bpmnElement="gw" isMarkerVisible="true"><dc:Bounds x="415" y="150" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="reserve_di" bpmnElement="reserve"><dc:Bounds x="520" y="285" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ask_di" bpmnElement="ask"><dc:Bounds x="520" y="135" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="late_di" bpmnElement="late"><dc:Bounds x="582" y="197" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="702" y="307" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="order_di" bpmnElement="orderRef"><dc:Bounds x="292" y="40" width="36" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="note_di" bpmnElement="note"><dc:Bounds x="380" y="40" width="120" height="30" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="f1_di" bpmnElement="f1"><di:waypoint x="208" y="175" /><di:waypoint x="260" y="175" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f2_di" bpmnElement="f2"><di:waypoint x="360" y="175" /><di:waypoint x="415" y="175" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="yes_di" bpmnElement="yes"><di:waypoint x="440" y="200" /><di:waypoint x="440" y="325" /><di:waypoint x="520" y="325" /><bpmndi:BPMNLabel><dc:Bounds x="446" y="250" width="20" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="no_di" bpmnElement="no"><di:waypoint x="465" y="175" /><di:waypoint x="520" y="175" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f5_di" bpmnElement="f5"><di:waypoint x="620" y="325" /><di:waypoint x="702" y="325" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="mf1_di" bpmnElement="mf1"><di:waypoint x="190" y="80" /><di:waypoint x="190" y="157" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="a1_di" bpmnElement="a1"><di:waypoint x="400" y="70" /><di:waypoint x="330" y="135" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="da1_di" bpmnElement="da1"><di:waypoint x="310" y="90" /><di:waypoint x="310" y="135" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const drawing = () => {
  const read = readBpmn(ORDER_PROCESS)
  if (!read.ok) throw new Error(read.refusal)
  return read.drawing
}
const shape = (id: string) => drawing().shapes.find((held) => held.id === id)!
const edge = (id: string) => drawing().edges.find((held) => held.id === id)!

describe('the shapes', () => {
  it('reads every shape the diagram places, pools and lanes first', () => {
    const kinds = drawing().shapes.map((held) => held.kind)
    expect(kinds.slice(0, 4)).toEqual(['participant', 'participant', 'lane', 'lane'])
    expect(drawing().shapes).toHaveLength(13)
  })

  it('names them and puts them where the file did', () => {
    expect(shape('acme')).toMatchObject({ kind: 'participant', name: 'Acme Logistics', bounds: { x: 100, y: 100, width: 700, height: 300 } })
    expect(shape('sales')).toMatchObject({ kind: 'lane', name: 'Sales' })
    expect(shape('check')).toMatchObject({ kind: 'task', taskType: 'userTask', name: 'Check the order & the customer' })
    expect(shape('reserve')).toMatchObject({ kind: 'task', taskType: 'serviceTask' })
  })

  it('tells the events apart by position and trigger', () => {
    expect(shape('start')).toMatchObject({ kind: 'event', eventPosition: 'start', eventTrigger: 'message', label: { x: 150, y: 200 } })
    expect(shape('start').throwing).toBeUndefined()
    expect(shape('late')).toMatchObject({ kind: 'event', eventPosition: 'boundary', eventTrigger: 'timer' })
    expect(shape('end')).toMatchObject({ kind: 'event', eventPosition: 'end', eventTrigger: 'none', throwing: true })
  })

  it('reads the gateway, the data object and the annotation’s text', () => {
    expect(shape('gw')).toMatchObject({ kind: 'gateway', gatewayType: 'exclusive', name: 'In stock?' })
    expect(shape('orderRef')).toMatchObject({ kind: 'dataObject', name: 'Order' })
    expect(shape('note')).toMatchObject({ kind: 'annotation', name: 'Within one working day' })
  })

  it('keeps a shape it does not know, as a box with its name', () => {
    const odd = ORDER_PROCESS
      .replace('<bpmn:serviceTask id="reserve" name="Reserve the stock" />', '<bpmn:somethingNew id="reserve" name="Reserve the stock" />')
    const read = readBpmn(odd)
    expect(read.ok && read.drawing.shapes.find((held) => held.id === 'reserve')).toMatchObject({ kind: 'unknown', name: 'Reserve the stock' })
  })
})

describe('the edges', () => {
  it('reads the flows with their waypoints', () => {
    expect(edge('f1')).toMatchObject({ kind: 'sequence', waypoints: [{ x: 208, y: 175 }, { x: 260, y: 175 }] })
    expect(edge('yes').waypoints).toHaveLength(3)
    expect(edge('yes').label).toEqual({ x: 446, y: 250, width: 20, height: 14 })
  })

  it('marks the gateway’s default path and the conditional one', () => {
    expect(edge('yes')).toMatchObject({ isDefault: true, name: 'yes' })
    expect(edge('yes').conditional).toBeUndefined()
    expect(edge('no')).toMatchObject({ conditional: true })
    expect(edge('no').isDefault).toBeUndefined()
  })

  it('tells a message flow, an association and a data association apart', () => {
    expect(edge('mf1')).toMatchObject({ kind: 'message', name: 'order' })
    expect(edge('a1')).toMatchObject({ kind: 'association' })
    expect(edge('a1').directed).toBeUndefined()
    expect(edge('da1')).toMatchObject({ kind: 'dataAssociation', directed: true })
  })
})

describe('the bounds', () => {
  it('go around every shape, label and waypoint', () => {
    expect(drawing().bounds).toEqual({ x: 100, y: 20, width: 700, height: 380 })
  })
})

describe('what is refused', () => {
  it('says when the XML does not parse', () => {
    expect(readBpmn('<bpmn:definitions><bpmn:process>')).toEqual({ ok: false, refusal: 'bpmn.malformed' })
    expect(readBpmn('<a></b>')).toEqual({ ok: false, refusal: 'bpmn.malformed' })
  })

  it('says when it is not BPMN at all', () => {
    expect(readBpmn('<svg xmlns="http://www.w3.org/2000/svg"/>')).toEqual({ ok: false, refusal: 'bpmn.notBpmn' })
  })

  it('says when there is no diagram section to place anything with', () => {
    const bare = ORDER_PROCESS.replace(/<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/, '')
    expect(readBpmn(bare)).toEqual({ ok: false, refusal: 'bpmn.noDiagram' })
  })
})

describe('the XML reader', () => {
  it('reads elements, attributes in either quote, nesting, text and self-closing tags by local name', () => {
    const root = readXml(`<a:root x="1" y='two'><b:child/><c:leaf>hi</c:leaf></a:root>`)!
    expect(root.name).toBe('root')
    expect(root.attributes).toEqual({ x: '1', y: 'two' })
    expect(root.children.map((child) => child.name)).toEqual(['child', 'leaf'])
    expect(root.children[1].text).toBe('hi')
  })

  it('skips the declaration, comments and a doctype, and reads CDATA and entities', () => {
    const root = readXml(`<?xml version="1.0"?><!DOCTYPE x><!-- note --><r a="&lt;b&gt; &amp; &#65;"><![CDATA[x < y]]></r>`)!
    expect(root.attributes.a).toBe('<b> & A')
    expect(root.text).toBe('x < y')
  })

  it('honours a > inside a quoted attribute', () => {
    const root = readXml(`<r title="a > b"><c/></r>`)!
    expect(root.attributes.title).toBe('a > b')
    expect(root.children).toHaveLength(1)
  })

  it('answers with nothing for two roots or an unclosed tag', () => {
    expect(readXml('<a/><b/>')).toBeUndefined()
    expect(readXml('<a><b></a>')).toBeUndefined()
    expect(readXml('<a')).toBeUndefined()
  })
})

describe('wrapLabel', () => {
  it('breaks on spaces to fit a width, and keeps a long word whole', () => {
    expect(wrapLabel('Check the order and the customer', 64)).toEqual(['Check the', 'order and', 'the', 'customer'])
    expect(wrapLabel('Antidisestablishmentarianism now', 64)).toEqual(['Antidisestablishmentarianism', 'now'])
  })

  it('keeps the lines the text already has', () => {
    expect(wrapLabel('one\ntwo', 200)).toEqual(['one', 'two'])
  })
})
