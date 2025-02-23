// code.ts
var DEFAULT_AUTO_LAYOUT = {
  direction: "HORIZONTAL",
  spacing: 8,
  padding: 0,
  alignment: "MIN"
};
var DEFAULT_GRID_LAYOUT = {
  columns: 3,
  rowSpacing: 16,
  columnSpacing: 16,
  alignment: "MIN"
};
var clone = (val) => JSON.parse(JSON.stringify(val));
var isShape = (node) => {
  return node.type === "RECTANGLE" || node.type === "ELLIPSE" || node.type === "VECTOR";
};
var isFigmaParent = (node) => {
  return "type" in node && (node.type === "FRAME" || node.type === "GROUP" || node.type === "PAGE");
};
var hasCornerRadius = (node) => {
  return "cornerRadius" in node;
};
var isSceneNode = (node) => {
  const validTypes = ["RECTANGLE", "ELLIPSE", "VECTOR", "FRAME", "GROUP", "COMPONENT", "INSTANCE", "TEXT"];
  return "type" in node && validTypes.indexOf(node.type) !== -1;
};
var supportsAutoLayout = (node) => {
  const validTypes = ["FRAME", "COMPONENT", "INSTANCE"];
  return validTypes.indexOf(node.type) !== -1;
};
var copyNodeProperties = (source, target) => {
  Object.assign(target, {
    name: source.name,
    x: source.x,
    y: source.y
  });
  if ("opacity" in source && "opacity" in target) {
    target.opacity = source.opacity;
  }
  if ("blendMode" in source && "blendMode" in target) {
    target.blendMode = source.blendMode;
  }
  if ("fills" in source && "fills" in target) {
    target.fills = clone(source.fills);
  }
  if ("strokes" in source && "strokes" in target) {
    target.strokes = clone(source.strokes);
    target.strokeWeight = source.strokeWeight;
    if ("strokeAlign" in source) {
      target.strokeAlign = source.strokeAlign;
    }
  }
  if ("effects" in source && "effects" in target) {
    target.effects = clone(source.effects);
  }
  if ("width" in source && "height" in source && "resize" in target) {
    target.resize(source.width, source.height);
  }
  if (hasCornerRadius(source) && hasCornerRadius(target)) {
    if (source.cornerRadius !== figma.mixed) {
      target.cornerRadius = source.cornerRadius;
    } else {
      Object.assign(target, {
        topLeftRadius: source.topLeftRadius,
        topRightRadius: source.topRightRadius,
        bottomLeftRadius: source.bottomLeftRadius,
        bottomRightRadius: source.bottomRightRadius
      });
    }
  }
};
var applyAutoLayout = (node, options) => {
  if (!supportsAutoLayout(node))
    return;
  Object.assign(node, {
    layoutMode: options.direction,
    itemSpacing: options.spacing,
    primaryAxisAlignItems: options.alignment
  });
  if (typeof options.padding === "number") {
    Object.assign(node, {
      paddingTop: options.padding,
      paddingRight: options.padding,
      paddingBottom: options.padding,
      paddingLeft: options.padding
    });
  } else {
    Object.assign(node, {
      paddingTop: options.padding.top,
      paddingRight: options.padding.right,
      paddingBottom: options.padding.bottom,
      paddingLeft: options.padding.left
    });
  }
};
async function shapeToFrame(node, options = {}) {
  try {
    const newNode = options.createComponent ? figma.createComponent() : figma.createFrame();
    newNode.name = node.name.replace(node.type === "RECTANGLE" ? "Rectangle" : node.type === "ELLIPSE" ? "Ellipse" : "Vector", options.createComponent ? "Component" : "Frame");
    copyNodeProperties(node, newNode);
    if (node.type === "ELLIPSE") {
      newNode.cornerRadius = newNode.width * 2;
    }
    if (options.autoLayout) {
      applyAutoLayout(newNode, options.autoLayout);
    }
    if (options.createComponent && options.componentDescription && newNode.type === "COMPONENT") {
      newNode.description = options.componentDescription;
    }
    if (node.parent && isFigmaParent(node.parent)) {
      node.parent.insertChild(0, newNode);
    }
    node.remove();
    return {
      node: newNode,
      success: true,
      message: `Converted to ${options.createComponent ? "component" : "frame"} successfully!`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node,
      success: false,
      message: `Error converting shape: ${errorMessage}`
    };
  }
}
async function frameToShape(frame) {
  try {
    const shape = figma.createRectangle();
    const isEllipse = frame.cornerRadius !== figma.mixed && frame.cornerRadius >= frame.width * 2;
    shape.name = frame.name.replace("Frame", isEllipse ? "Ellipse" : "Rectangle");
    copyNodeProperties(frame, shape);
    if (frame.parent && isFigmaParent(frame.parent)) {
      frame.parent.insertChild(0, shape);
    }
    for (const child of frame.children) {
      if (isSceneNode(child)) {
        figma.currentPage.appendChild(child);
        child.x = frame.x + child.x;
        child.y = frame.y + child.y;
      }
    }
    frame.remove();
    return {
      node: shape,
      success: true,
      message: "Converted successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: frame,
      success: false,
      message: `Error converting frame: ${errorMessage}`
    };
  }
}
async function recursiveGroupToFrame(group, options = {}) {
  try {
    const frame = figma.createFrame();
    frame.name = group.name.replace("Group", "Frame");
    frame.resize(group.width, group.height);
    frame.x = group.x;
    frame.y = group.y;
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }
    const children = Array.from(group.children).reverse();
    for (const child of children) {
      if (isSceneNode(child)) {
        if (options.recursive && child.type === "GROUP") {
          const result = await recursiveGroupToFrame(child, options);
          if (result.success) {
            frame.appendChild(result.node);
          }
        } else {
          const coords = {
            x: child.x - group.x,
            y: child.y - group.y
          };
          frame.appendChild(child);
          child.x = coords.x;
          child.y = coords.y;
        }
      }
    }
    if (group.parent && isFigmaParent(group.parent)) {
      const index = group.parent.children.indexOf(group);
      group.parent.insertChild(index, frame);
    }
    group.remove();
    return {
      node: frame,
      success: true,
      message: "Group converted to frame successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: group,
      success: false,
      message: `Error converting group: ${errorMessage}`
    };
  }
}
async function componentToFrame(component, options = {}) {
  try {
    const frame = figma.createFrame();
    frame.name = component.name.replace("Component", "Frame");
    copyNodeProperties(component, frame);
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }
    const children = Array.from(component.children);
    for (const child of children) {
      if (isSceneNode(child)) {
        const coords = {
          x: child.x,
          y: child.y
        };
        frame.appendChild(child);
        child.x = coords.x;
        child.y = coords.y;
      }
    }
    if (component.parent && isFigmaParent(component.parent)) {
      const index = component.parent.children.indexOf(component);
      component.parent.insertChild(index, frame);
    }
    component.remove();
    return {
      node: frame,
      success: true,
      message: "Component converted to frame successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: component,
      success: false,
      message: `Error converting component: ${errorMessage}`
    };
  }
}
async function componentToGroup(component) {
  try {
    const group = figma.group(component.children, component.parent || figma.currentPage);
    group.name = component.name.replace("Component", "Group");
    group.x = component.x;
    group.y = component.y;
    if ("opacity" in component) {
      group.opacity = component.opacity;
    }
    if ("blendMode" in component) {
      group.blendMode = component.blendMode;
    }
    if (component.parent && isFigmaParent(component.parent)) {
      const index = component.parent.children.indexOf(component);
      component.parent.insertChild(index, group);
    }
    component.remove();
    return {
      node: group,
      success: true,
      message: "Component converted to group successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: component,
      success: false,
      message: `Error converting component: ${errorMessage}`
    };
  }
}
async function componentToShape(component) {
  try {
    if (component.children.length > 0) {
      return {
        node: component,
        success: false,
        message: "Cannot convert component with children to shape. Please use 'Component to Frame' instead."
      };
    }
    const shape = figma.createRectangle();
    shape.name = component.name.replace("Component", "Rectangle");
    copyNodeProperties(component, shape);
    if (component.parent && isFigmaParent(component.parent)) {
      const index = component.parent.children.indexOf(component);
      component.parent.insertChild(index, shape);
    }
    component.remove();
    return {
      node: shape,
      success: true,
      message: "Component converted to shape successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: component,
      success: false,
      message: `Error converting component: ${errorMessage}`
    };
  }
}
async function instanceToComponent(instance) {
  try {
    const childInfo = [];
    instance.children.forEach((child, index) => {
      if (isSceneNode(child)) {
        let absoluteX = child.x;
        let absoluteY = child.y;
        let parent2 = child.parent;
        while (parent2 && "x" in parent2 && "y" in parent2) {
          absoluteX += parent2.x;
          absoluteY += parent2.y;
          parent2 = parent2.parent;
        }
        childInfo.push({ index, absoluteX, absoluteY });
      }
    });
    const component = figma.createComponent();
    component.name = instance.name.replace("Instance", "Component");
    component.resize(instance.width, instance.height);
    let instanceAbsoluteX = instance.x;
    let instanceAbsoluteY = instance.y;
    let parent = instance.parent;
    while (parent && "x" in parent && "y" in parent) {
      instanceAbsoluteX += parent.x;
      instanceAbsoluteY += parent.y;
      parent = parent.parent;
    }
    component.x = instanceAbsoluteX;
    component.y = instanceAbsoluteY;
    if (instance.parent && isFigmaParent(instance.parent)) {
      const index = instance.parent.children.indexOf(instance);
      instance.parent.insertChild(index, component);
    }
    if ("opacity" in instance) {
      component.opacity = instance.opacity;
    }
    if ("blendMode" in instance) {
      component.blendMode = instance.blendMode;
    }
    if ("effects" in instance) {
      component.effects = clone(instance.effects);
    }
    if ("fills" in instance) {
      component.fills = clone(instance.fills);
    }
    if ("strokes" in instance) {
      component.strokes = clone(instance.strokes);
      component.strokeWeight = instance.strokeWeight;
      if ("strokeAlign" in instance) {
        component.strokeAlign = instance.strokeAlign;
      }
    }
    if ("componentProperties" in instance) {
      const properties = instance.componentProperties;
      const keys = Object.keys(properties);
      for (const key of keys) {
        const prop = properties[key];
        if (prop && "value" in prop && "type" in prop) {
          component.addComponentProperty(key, prop.type, prop.value);
        }
      }
    }
    const detached = instance.detachInstance();
    const children = Array.prototype.slice.call(detached.children);
    childInfo.forEach((info) => {
      const child = children[info.index];
      if (isSceneNode(child)) {
        const newX = info.absoluteX - component.x;
        const newY = info.absoluteY - component.y;
        component.appendChild(child);
        child.x = newX;
        child.y = newY;
      }
    });
    detached.remove();
    instance.remove();
    return {
      node: component,
      success: true,
      message: "Instance converted to component successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: instance,
      success: false,
      message: `Error converting instance: ${errorMessage}`
    };
  }
}
async function applyGridLayout(frame, options) {
  frame.layoutMode = "HORIZONTAL";
  frame.itemSpacing = options.columnSpacing;
  frame.counterAxisSpacing = options.rowSpacing;
  frame.layoutWrap = "WRAP";
  frame.primaryAxisAlignItems = options.alignment;
  frame.counterAxisAlignItems = options.alignment;
  const firstChild = frame.children.length > 0 ? frame.children[0] : null;
  const itemWidth = firstChild && "width" in firstChild ? firstChild.width : 0;
  const totalWidth = frame.width;
  const columns = options.columns || Math.floor(totalWidth / (itemWidth + options.columnSpacing));
  frame.layoutGrids = [
    {
      pattern: "GRID",
      sectionSize: itemWidth,
      visible: true,
      color: { r: 0, g: 0, b: 1, a: 0.1 }
    }
  ];
}
async function frameToGrid(frame, options = {}) {
  try {
    if (frame.children.length === 0) {
      return {
        node: frame,
        success: false,
        message: "Frame must have children to convert to grid layout"
      };
    }
    await applyGridLayout(frame, options.gridLayout || DEFAULT_GRID_LAYOUT);
    return {
      node: frame,
      success: true,
      message: "Frame converted to grid layout successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: frame,
      success: false,
      message: `Error converting to grid: ${errorMessage}`
    };
  }
}
async function textToFrame(text, options = {}) {
  try {
    const frame = figma.createFrame();
    frame.name = text.name + " Frame";
    frame.resize(text.width, text.height);
    frame.x = text.x;
    frame.y = text.y;
    if (options.preserveText) {
      const characters = text.characters.split("");
      let currentX = 0;
      for (const char of characters) {
        const charFrame = figma.createText();
        charFrame.characters = char;
        charFrame.fontSize = text.fontSize;
        charFrame.fontName = text.fontName;
        charFrame.textAlignHorizontal = text.textAlignHorizontal;
        charFrame.textAlignVertical = text.textAlignVertical;
        charFrame.x = currentX;
        frame.appendChild(charFrame);
        currentX += charFrame.width;
      }
    } else {
      const newText = figma.createText();
      newText.characters = text.characters;
      newText.fontSize = text.fontSize;
      newText.fontName = text.fontName;
      newText.textAlignHorizontal = text.textAlignHorizontal;
      newText.textAlignVertical = text.textAlignVertical;
      frame.appendChild(newText);
    }
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }
    if (text.parent && isFigmaParent(text.parent)) {
      const index = text.parent.children.indexOf(text);
      text.parent.insertChild(index, frame);
    }
    text.remove();
    return {
      node: frame,
      success: true,
      message: "Text converted to frame successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: text,
      success: false,
      message: `Error converting text: ${errorMessage}`
    };
  }
}
async function vectorToFrame(vector, options = {}) {
  try {
    const frame = figma.createFrame();
    frame.name = vector.name.replace("Vector", "Frame");
    copyNodeProperties(vector, frame);
    if (options.vectorToShapes) {
      const vectorNetwork = vector.vectorNetwork;
      for (const path of vectorNetwork.vertices) {
        const point = figma.createEllipse();
        point.resize(4, 4);
        point.x = path.x - 2;
        point.y = path.y - 2;
        point.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
        frame.appendChild(point);
      }
    } else {
      const clone2 = vector.clone();
      frame.appendChild(clone2);
    }
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }
    if (vector.parent && isFigmaParent(vector.parent)) {
      const index = vector.parent.children.indexOf(vector);
      vector.parent.insertChild(index, frame);
    }
    vector.remove();
    return {
      node: frame,
      success: true,
      message: "Vector converted to frame successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: vector,
      success: false,
      message: `Error converting vector: ${errorMessage}`
    };
  }
}
async function frameToComponent(frame) {
  try {
    const component = figma.createComponent();
    component.name = frame.name;
    copyNodeProperties(frame, component);
    for (const child of [...frame.children]) {
      if (isSceneNode(child)) {
        const coords = {
          x: child.x,
          y: child.y
        };
        component.appendChild(child);
        child.x = coords.x;
        child.y = coords.y;
      }
    }
    if (frame.parent && isFigmaParent(frame.parent)) {
      const index = frame.parent.children.indexOf(frame);
      frame.parent.insertChild(index, component);
    }
    frame.remove();
    return {
      node: component,
      success: true,
      message: "Frame converted to component successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: frame,
      success: false,
      message: `Error converting frame: ${errorMessage}`
    };
  }
}
async function groupToComponent(group) {
  try {
    const component = figma.createComponent();
    component.name = group.name;
    component.resize(group.width, group.height);
    component.x = group.x;
    component.y = group.y;
    for (const child of [...group.children].reverse()) {
      if (isSceneNode(child)) {
        const coords = {
          x: child.x - group.x,
          y: child.y - group.y
        };
        component.appendChild(child);
        child.x = coords.x;
        child.y = coords.y;
      }
    }
    if (group.parent && isFigmaParent(group.parent)) {
      const index = group.parent.children.indexOf(group);
      group.parent.insertChild(index, component);
    }
    group.remove();
    return {
      node: component,
      success: true,
      message: "Group converted to component successfully!"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: group,
      success: false,
      message: `Error converting group: ${errorMessage}`
    };
  }
}
async function main() {
  const { selection } = figma.currentPage;
  const results = [];
  if (selection.length === 0) {
    figma.notify("Please select at least one element!");
    figma.closePlugin();
    return;
  }
  const options = {
    autoLayout: figma.command.indexOf("al-frame") !== -1 ? DEFAULT_AUTO_LAYOUT : undefined,
    gridLayout: figma.command.indexOf("grid") !== -1 ? DEFAULT_GRID_LAYOUT : undefined,
    createComponent: figma.command.indexOf("component") !== -1,
    recursive: figma.command.indexOf("recursive") !== -1,
    preserveHierarchy: figma.command.indexOf("preserve") !== -1,
    preserveText: true,
    vectorToShapes: false
  };
  for (const node of selection) {
    let result = null;
    switch (figma.command) {
      case "shape-to-frame":
      case "shape-to-al-frame":
      case "shape-to-component":
        result = isShape(node) ? await shapeToFrame(node, options) : { node, success: false, message: "Please select a shape!" };
        break;
      case "frame-to-shape":
        result = node.type === "FRAME" ? await frameToShape(node) : { node, success: false, message: "Please select a frame!" };
        break;
      case "group-to-frame":
      case "group-to-frame-recursive":
        result = node.type === "GROUP" ? await recursiveGroupToFrame(node, options) : { node, success: false, message: "Please select a group!" };
        break;
      case "component-to-frame":
      case "component-to-al-frame":
        result = node.type === "COMPONENT" || node.type === "INSTANCE" ? await componentToFrame(node, options) : { node, success: false, message: "Please select a component or instance!" };
        break;
      case "component-to-group":
        result = node.type === "COMPONENT" || node.type === "INSTANCE" ? await componentToGroup(node) : { node, success: false, message: "Please select a component or instance!" };
        break;
      case "component-to-shape":
        result = node.type === "COMPONENT" || node.type === "INSTANCE" ? await componentToShape(node) : { node, success: false, message: "Please select a component or instance!" };
        break;
      case "instance-to-component":
        result = node.type === "INSTANCE" ? await instanceToComponent(node) : { node, success: false, message: "Please select an instance!" };
        break;
      case "frame-to-grid":
        result = node.type === "FRAME" ? await frameToGrid(node, options) : { node, success: false, message: "Please select a frame!" };
        break;
      case "text-to-frame":
        result = node.type === "TEXT" ? await textToFrame(node, options) : { node, success: false, message: "Please select a text layer!" };
        break;
      case "vector-to-frame":
        result = node.type === "VECTOR" ? await vectorToFrame(node, options) : { node, success: false, message: "Please select a vector!" };
        break;
      case "frame-to-component":
        result = node.type === "FRAME" ? await frameToComponent(node) : { node, success: false, message: "Please select a frame!" };
        break;
      case "group-to-component":
        result = node.type === "GROUP" ? await groupToComponent(node) : { node, success: false, message: "Please select a group!" };
        break;
    }
    if (result && result.success) {
      results.push(result.node);
      figma.notify(result.message);
    } else if (result) {
      figma.notify(result.message);
    }
  }
  if (results.length > 0) {
    figma.currentPage.selection = results;
    figma.viewport.scrollAndZoomIntoView(results);
  }
}
main().then(() => figma.closePlugin());
