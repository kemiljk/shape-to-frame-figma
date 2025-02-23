// Types for common operations
type ShapeNode = RectangleNode | EllipseNode | VectorNode;
type ContainerNode = FrameNode | GroupNode;
type FigmaParentNode = ContainerNode | PageNode;
type AutoLayoutNode = FrameNode | ComponentNode | InstanceNode;

interface AutoLayoutOptions {
  direction: "HORIZONTAL" | "VERTICAL";
  spacing: number;
  padding: number | { top: number; right: number; bottom: number; left: number };
  alignment: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
}

interface GridLayoutOptions {
  columns: number;
  rowSpacing: number;
  columnSpacing: number;
  alignment: "MIN" | "CENTER" | "MAX";
}

interface ConversionResult {
  node: SceneNode;
  success: boolean;
  message: string;
}

interface ConversionOptions {
  autoLayout?: AutoLayoutOptions;
  gridLayout?: GridLayoutOptions;
  createComponent?: boolean;
  componentDescription?: string;
  preserveHierarchy?: boolean;
  recursive?: boolean;
  preserveText?: boolean; // For text conversion
  vectorToShapes?: boolean; // For vector conversion
}

const DEFAULT_AUTO_LAYOUT: AutoLayoutOptions = {
  direction: "HORIZONTAL",
  spacing: 8,
  padding: 0,
  alignment: "MIN",
};

const DEFAULT_GRID_LAYOUT: GridLayoutOptions = {
  columns: 3,
  rowSpacing: 16,
  columnSpacing: 16,
  alignment: "MIN",
};

// Helper function to deep clone properties
const clone = <T>(val: T): T => JSON.parse(JSON.stringify(val));

// Type guards as const arrow functions
const isShape = (node: SceneNode): node is ShapeNode => {
  return node.type === "RECTANGLE" || node.type === "ELLIPSE" || node.type === "VECTOR";
};

const isContainer = (node: BaseNode): node is ContainerNode => {
  return "type" in node && (node.type === "FRAME" || node.type === "GROUP");
};

const isFigmaParent = (node: BaseNode): node is FigmaParentNode => {
  return "type" in node && (node.type === "FRAME" || node.type === "GROUP" || node.type === "PAGE");
};

const hasCornerRadius = (node: SceneNode): node is RectangleNode | FrameNode => {
  return "cornerRadius" in node;
};

const isSceneNode = (node: BaseNode): node is SceneNode => {
  const validTypes = ["RECTANGLE", "ELLIPSE", "VECTOR", "FRAME", "GROUP", "COMPONENT", "INSTANCE", "TEXT"];
  return "type" in node && validTypes.indexOf(node.type) !== -1;
};

const supportsAutoLayout = (node: SceneNode): node is AutoLayoutNode => {
  const validTypes = ["FRAME", "COMPONENT", "INSTANCE"];
  return validTypes.indexOf(node.type) !== -1;
};

const copyNodeProperties = (source: SceneNode, target: SceneNode): void => {
  // Copy common properties
  Object.assign(target, {
    name: source.name,
    x: source.x,
    y: source.y,
  });

  // Copy blend properties if available
  if ("opacity" in source && "opacity" in target) {
    target.opacity = source.opacity;
  }
  if ("blendMode" in source && "blendMode" in target) {
    target.blendMode = source.blendMode;
  }

  // Copy fills and strokes if available
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

  // Handle size
  if ("width" in source && "height" in source && "resize" in target) {
    target.resize(source.width, source.height);
  }

  // Handle corner radius for rectangle and frame nodes
  if (hasCornerRadius(source) && hasCornerRadius(target)) {
    if (source.cornerRadius !== figma.mixed) {
      target.cornerRadius = source.cornerRadius;
    } else {
      Object.assign(target, {
        topLeftRadius: source.topLeftRadius,
        topRightRadius: source.topRightRadius,
        bottomLeftRadius: source.bottomLeftRadius,
        bottomRightRadius: source.bottomRightRadius,
      });
    }
  }
};

const applyAutoLayout = (node: SceneNode, options: AutoLayoutOptions): void => {
  if (!supportsAutoLayout(node)) return;

  Object.assign(node, {
    layoutMode: options.direction,
    itemSpacing: options.spacing,
    primaryAxisAlignItems: options.alignment,
  });

  if (typeof options.padding === "number") {
    Object.assign(node, {
      paddingTop: options.padding,
      paddingRight: options.padding,
      paddingBottom: options.padding,
      paddingLeft: options.padding,
    });
  } else {
    Object.assign(node, {
      paddingTop: options.padding.top,
      paddingRight: options.padding.right,
      paddingBottom: options.padding.bottom,
      paddingLeft: options.padding.left,
    });
  }
};

async function shapeToFrame(node: ShapeNode, options: ConversionOptions = {}): Promise<ConversionResult> {
  try {
    // Create either a frame or component
    const newNode = options.createComponent ? figma.createComponent() : figma.createFrame();

    // Set name based on original shape
    newNode.name = node.name.replace(node.type === "RECTANGLE" ? "Rectangle" : node.type === "ELLIPSE" ? "Ellipse" : "Vector", options.createComponent ? "Component" : "Frame");

    copyNodeProperties(node, newNode);

    // Special handling for ellipse
    if (node.type === "ELLIPSE") {
      newNode.cornerRadius = newNode.width * 2;
    }

    // Apply auto layout if requested
    if (options.autoLayout) {
      applyAutoLayout(newNode, options.autoLayout);
    }

    // Add description for components
    if (options.createComponent && options.componentDescription && newNode.type === "COMPONENT") {
      newNode.description = options.componentDescription;
    }

    // Handle parent container
    if (node.parent && isFigmaParent(node.parent)) {
      node.parent.insertChild(0, newNode);
    }

    node.remove();

    return {
      node: newNode,
      success: true,
      message: `Converted to ${options.createComponent ? "component" : "frame"} successfully!`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: node,
      success: false,
      message: `Error converting shape: ${errorMessage}`,
    };
  }
}

async function frameToShape(frame: FrameNode): Promise<ConversionResult> {
  try {
    const shape = figma.createRectangle();
    const isEllipse = frame.cornerRadius !== figma.mixed && frame.cornerRadius >= frame.width * 2;

    shape.name = frame.name.replace("Frame", isEllipse ? "Ellipse" : "Rectangle");
    copyNodeProperties(frame, shape);

    // Handle parent container
    if (frame.parent && isFigmaParent(frame.parent)) {
      frame.parent.insertChild(0, shape);
    }

    // Handle children
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
      message: "Converted successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: frame,
      success: false,
      message: `Error converting frame: ${errorMessage}`,
    };
  }
}

async function recursiveGroupToFrame(group: GroupNode, options: ConversionOptions = {}): Promise<ConversionResult> {
  try {
    const frame = figma.createFrame();
    frame.name = group.name.replace("Group", "Frame");
    frame.resize(group.width, group.height);
    frame.x = group.x;
    frame.y = group.y;

    // Apply auto layout if requested
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }

    // Process children recursively if requested
    const children = Array.from(group.children).reverse();
    for (const child of children) {
      if (isSceneNode(child)) {
        if (options.recursive && child.type === "GROUP") {
          const result = await recursiveGroupToFrame(child as GroupNode, options);
          if (result.success) {
            frame.appendChild(result.node);
          }
        } else {
          const coords = {
            x: child.x - group.x,
            y: child.y - group.y,
          };
          frame.appendChild(child);
          child.x = coords.x;
          child.y = coords.y;
        }
      }
    }

    // Insert frame at the same position as group
    if (group.parent && isFigmaParent(group.parent)) {
      const index = group.parent.children.indexOf(group);
      group.parent.insertChild(index, frame);
    }

    group.remove();

    return {
      node: frame,
      success: true,
      message: "Group converted to frame successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: group,
      success: false,
      message: `Error converting group: ${errorMessage}`,
    };
  }
}

async function componentToFrame(component: ComponentNode | InstanceNode, options: ConversionOptions = {}): Promise<ConversionResult> {
  try {
    // Create the target frame
    const frame = figma.createFrame();
    frame.name = component.name.replace("Component", "Frame");

    // Copy all properties
    copyNodeProperties(component, frame);

    // Apply auto layout if requested
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }

    // Handle children
    const children = Array.from(component.children);
    for (const child of children) {
      if (isSceneNode(child)) {
        const coords = {
          x: child.x,
          y: child.y,
        };
        frame.appendChild(child);
        child.x = coords.x;
        child.y = coords.y;
      }
    }

    // Insert frame at the same position
    if (component.parent && isFigmaParent(component.parent)) {
      const index = component.parent.children.indexOf(component);
      component.parent.insertChild(index, frame);
    }

    component.remove();

    return {
      node: frame,
      success: true,
      message: "Component converted to frame successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: component,
      success: false,
      message: `Error converting component: ${errorMessage}`,
    };
  }
}

async function componentToGroup(component: ComponentNode | InstanceNode): Promise<ConversionResult> {
  try {
    // Create the target group
    const group = figma.group(component.children, component.parent || figma.currentPage);
    group.name = component.name.replace("Component", "Group");

    // Copy applicable properties
    group.x = component.x;
    group.y = component.y;
    if ("opacity" in component) {
      group.opacity = component.opacity;
    }
    if ("blendMode" in component) {
      group.blendMode = component.blendMode;
    }

    // Position the group correctly
    if (component.parent && isFigmaParent(component.parent)) {
      const index = component.parent.children.indexOf(component);
      component.parent.insertChild(index, group);
    }

    component.remove();

    return {
      node: group,
      success: true,
      message: "Component converted to group successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: component,
      success: false,
      message: `Error converting component: ${errorMessage}`,
    };
  }
}

async function componentToShape(component: ComponentNode | InstanceNode): Promise<ConversionResult> {
  try {
    if (component.children.length > 0) {
      return {
        node: component,
        success: false,
        message: "Cannot convert component with children to shape. Please use 'Component to Frame' instead.",
      };
    }

    const shape = figma.createRectangle();
    shape.name = component.name.replace("Component", "Rectangle");

    copyNodeProperties(component, shape);

    // Insert shape at the same position
    if (component.parent && isFigmaParent(component.parent)) {
      const index = component.parent.children.indexOf(component);
      component.parent.insertChild(index, shape);
    }

    component.remove();

    return {
      node: shape,
      success: true,
      message: "Component converted to shape successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: component,
      success: false,
      message: `Error converting component: ${errorMessage}`,
    };
  }
}

async function instanceToComponent(instance: InstanceNode): Promise<ConversionResult> {
  try {
    // Store child positions and indices before detaching
    const childInfo: Array<{ index: number; absoluteX: number; absoluteY: number }> = [];
    instance.children.forEach((child, index) => {
      if (isSceneNode(child)) {
        // Calculate absolute position by traversing up the parent chain
        let absoluteX = child.x;
        let absoluteY = child.y;
        let parent = child.parent;
        while (parent && "x" in parent && "y" in parent) {
          absoluteX += parent.x;
          absoluteY += parent.y;
          parent = parent.parent;
        }
        childInfo.push({ index, absoluteX, absoluteY });
      }
    });

    // Create the new component
    const component = figma.createComponent();
    component.name = instance.name.replace("Instance", "Component");
    component.resize(instance.width, instance.height);

    // Calculate the absolute position of the instance
    let instanceAbsoluteX = instance.x;
    let instanceAbsoluteY = instance.y;
    let parent = instance.parent;
    while (parent && "x" in parent && "y" in parent) {
      instanceAbsoluteX += parent.x;
      instanceAbsoluteY += parent.y;
      parent = parent.parent;
    }

    // Position the component at the same absolute position
    component.x = instanceAbsoluteX;
    component.y = instanceAbsoluteY;

    // Insert the new component at the same position before modifying children
    if (instance.parent && isFigmaParent(instance.parent)) {
      const index = instance.parent.children.indexOf(instance);
      instance.parent.insertChild(index, component);
    }

    // Copy visual properties
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

    // Copy component properties if any
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

    // Detach the instance to access its children
    const detached = instance.detachInstance();

    // Now handle the children from the detached instance
    const children = Array.prototype.slice.call(detached.children);
    childInfo.forEach((info) => {
      const child = children[info.index];
      if (isSceneNode(child)) {
        // Calculate the new relative position based on the component's absolute position
        const newX = info.absoluteX - component.x;
        const newY = info.absoluteY - component.y;
        component.appendChild(child);
        child.x = newX;
        child.y = newY;
      }
    });

    // Remove the original instance and detached frame
    detached.remove();
    instance.remove();

    return {
      node: component,
      success: true,
      message: "Instance converted to component successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: instance,
      success: false,
      message: `Error converting instance: ${errorMessage}`,
    };
  }
}

async function applyGridLayout(frame: FrameNode | ComponentNode, options: GridLayoutOptions): Promise<void> {
  frame.layoutMode = "HORIZONTAL";
  frame.itemSpacing = options.columnSpacing;
  frame.counterAxisSpacing = options.rowSpacing;
  frame.layoutWrap = "WRAP";
  frame.primaryAxisAlignItems = options.alignment;
  frame.counterAxisAlignItems = options.alignment;

  // Calculate and set the number of items per row
  const firstChild = frame.children.length > 0 ? frame.children[0] : null;
  const itemWidth = firstChild && "width" in firstChild ? firstChild.width : 0;
  const totalWidth = frame.width;
  const columns = options.columns || Math.floor(totalWidth / (itemWidth + options.columnSpacing));

  frame.layoutGrids = [
    {
      pattern: "GRID",
      sectionSize: itemWidth,
      visible: true,
      color: { r: 0, g: 0, b: 1, a: 0.1 },
    },
  ];
}

async function frameToGrid(frame: FrameNode, options: ConversionOptions = {}): Promise<ConversionResult> {
  try {
    if (frame.children.length === 0) {
      return {
        node: frame,
        success: false,
        message: "Frame must have children to convert to grid layout",
      };
    }

    // Apply grid layout
    await applyGridLayout(frame, options.gridLayout || DEFAULT_GRID_LAYOUT);

    return {
      node: frame,
      success: true,
      message: "Frame converted to grid layout successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: frame,
      success: false,
      message: `Error converting to grid: ${errorMessage}`,
    };
  }
}

async function textToFrame(text: TextNode, options: ConversionOptions = {}): Promise<ConversionResult> {
  try {
    const frame = figma.createFrame();
    frame.name = text.name + " Frame";
    frame.resize(text.width, text.height);
    frame.x = text.x;
    frame.y = text.y;

    if (options.preserveText) {
      // Create individual text frames for each character
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
      // Create a single text node
      const newText = figma.createText();
      newText.characters = text.characters;
      newText.fontSize = text.fontSize;
      newText.fontName = text.fontName;
      newText.textAlignHorizontal = text.textAlignHorizontal;
      newText.textAlignVertical = text.textAlignVertical;
      frame.appendChild(newText);
    }

    // Apply auto layout if requested
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }

    // Insert at the same position
    if (text.parent && isFigmaParent(text.parent)) {
      const index = text.parent.children.indexOf(text);
      text.parent.insertChild(index, frame);
    }

    text.remove();

    return {
      node: frame,
      success: true,
      message: "Text converted to frame successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: text,
      success: false,
      message: `Error converting text: ${errorMessage}`,
    };
  }
}

async function vectorToFrame(vector: VectorNode, options: ConversionOptions = {}): Promise<ConversionResult> {
  try {
    const frame = figma.createFrame();
    frame.name = vector.name.replace("Vector", "Frame");

    copyNodeProperties(vector, frame);

    if (options.vectorToShapes) {
      // Convert vector points to shapes
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
      // Keep the vector as is
      const clone = vector.clone();
      frame.appendChild(clone);
    }

    // Apply auto layout if requested
    if (options.autoLayout) {
      applyAutoLayout(frame, options.autoLayout);
    }

    // Insert at the same position
    if (vector.parent && isFigmaParent(vector.parent)) {
      const index = vector.parent.children.indexOf(vector);
      vector.parent.insertChild(index, frame);
    }

    vector.remove();

    return {
      node: frame,
      success: true,
      message: "Vector converted to frame successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: vector,
      success: false,
      message: `Error converting vector: ${errorMessage}`,
    };
  }
}

async function frameToComponent(frame: FrameNode): Promise<ConversionResult> {
  try {
    const component = figma.createComponent();
    component.name = frame.name;

    // Copy all properties
    copyNodeProperties(frame, component);

    // Handle children
    for (const child of [...frame.children]) {
      if (isSceneNode(child)) {
        const coords = {
          x: child.x,
          y: child.y,
        };
        component.appendChild(child);
        child.x = coords.x;
        child.y = coords.y;
      }
    }

    // Insert at the same position
    if (frame.parent && isFigmaParent(frame.parent)) {
      const index = frame.parent.children.indexOf(frame);
      frame.parent.insertChild(index, component);
    }

    frame.remove();

    return {
      node: component,
      success: true,
      message: "Frame converted to component successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: frame,
      success: false,
      message: `Error converting frame: ${errorMessage}`,
    };
  }
}

async function groupToComponent(group: GroupNode): Promise<ConversionResult> {
  try {
    const component = figma.createComponent();
    component.name = group.name;
    component.resize(group.width, group.height);
    component.x = group.x;
    component.y = group.y;

    // Process children
    for (const child of [...group.children].reverse()) {
      if (isSceneNode(child)) {
        const coords = {
          x: child.x - group.x,
          y: child.y - group.y,
        };
        component.appendChild(child);
        child.x = coords.x;
        child.y = coords.y;
      }
    }

    // Insert at the same position
    if (group.parent && isFigmaParent(group.parent)) {
      const index = group.parent.children.indexOf(group);
      group.parent.insertChild(index, component);
    }

    group.remove();

    return {
      node: component,
      success: true,
      message: "Group converted to component successfully!",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      node: group,
      success: false,
      message: `Error converting group: ${errorMessage}`,
    };
  }
}

async function main() {
  const { selection } = figma.currentPage;
  const results: SceneNode[] = [];

  if (selection.length === 0) {
    figma.notify("Please select at least one element!");
    figma.closePlugin();
    return;
  }

  const options: ConversionOptions = {
    autoLayout: figma.command.indexOf("al-frame") !== -1 ? DEFAULT_AUTO_LAYOUT : undefined,
    gridLayout: figma.command.indexOf("grid") !== -1 ? DEFAULT_GRID_LAYOUT : undefined,
    createComponent: figma.command.indexOf("component") !== -1,
    recursive: figma.command.indexOf("recursive") !== -1,
    preserveHierarchy: figma.command.indexOf("preserve") !== -1,
    preserveText: true,
    vectorToShapes: false,
  };

  for (const node of selection) {
    let result: ConversionResult | null = null;

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
