import { ToWwConvertorMap } from '@t/convertor';
import {
  MdNode,
  HeadingMdNode,
  CodeBlockMdNode,
  ListItemMdNode,
  ImageMdNode,
  LinkMdNode,
  CustomBlockMdNode
} from '@t/markdown';

import { reHTMLTag, htmlToWwConvertors } from './htmlToWwConvertors';

function getTextWithoutTrailingNewline(text: string) {
  return text[text.length - 1] === '\n' ? text.slice(0, text.length - 1) : text;
}

function isBRTag(node: MdNode) {
  return node.type === 'htmlInline' && /<br ?\/?>/.test(node.literal!);
}

export const toWwConvertors: ToWwConvertorMap = {
  text(state, node) {
    state.addText(node.literal || '');
  },

  paragraph(state, node, { entering }) {
    const { paragraph } = state.schema.nodes;

    if (entering) {
      if (node.prev?.type === 'paragraph') {
        state.openNode(paragraph);
        state.closeNode();
      }
      state.openNode(paragraph);
    } else {
      state.closeNode();
    }
  },

  heading(state, node, { entering }) {
    const { heading } = state.schema.nodes;

    if (entering) {
      state.openNode(heading, { level: (node as HeadingMdNode).level });
    } else {
      state.closeNode();
    }
  },

  codeBlock(state, node) {
    const { codeBlock } = state.schema.nodes;
    const { info, literal } = node as CodeBlockMdNode;

    state.openNode(codeBlock, { language: info });
    state.addText(getTextWithoutTrailingNewline(literal || ''));
    state.closeNode();
  },

  list(state, node, { entering }) {
    const { bulletList, orderedList } = state.schema.nodes;

    if (entering) {
      const { type, start } = (node as ListItemMdNode).listData;

      if (type === 'bullet') {
        state.openNode(bulletList);
      } else {
        state.openNode(orderedList, { order: start });
      }
    } else {
      state.closeNode();
    }
  },

  item(state, node, { entering }) {
    const { listItem } = state.schema.nodes;
    const { task, checked } = (node as ListItemMdNode).listData;

    if (entering) {
      const attrs = {
        ...(task && { task }),
        ...(checked && { checked })
      };

      state.openNode(listItem, attrs);
    } else {
      state.closeNode();
    }
  },

  blockQuote(state, _, { entering }) {
    const { blockQuote } = state.schema.nodes;

    if (entering) {
      state.openNode(blockQuote);
    } else {
      state.closeNode();
    }
  },

  image(state, node, { entering, skipChildren }) {
    const { image } = state.schema.nodes;
    const { destination, firstChild } = node as ImageMdNode;

    if (entering && skipChildren) {
      skipChildren();
    }

    state.addNode(image, {
      imageUrl: destination,
      ...(firstChild && { altText: firstChild.literal })
    });
  },

  thematicBreak(state) {
    state.addNode(state.schema.nodes.thematicBreak);
  },

  strong(state, _, { entering }) {
    const { strong } = state.schema.marks;

    if (entering) {
      state.openMark(strong.create());
    } else {
      state.closeMark(strong);
    }
  },

  emph(state, _, { entering }) {
    const { emph } = state.schema.marks;

    if (entering) {
      state.openMark(emph.create());
    } else {
      state.closeMark(emph);
    }
  },

  link(state, node, { entering }) {
    const { link } = state.schema.marks;
    const { destination, title } = node as LinkMdNode;

    if (entering) {
      const attrs = {
        linkUrl: destination,
        ...(title && { linkText: title })
      };

      state.openMark(link.create(attrs));
    } else {
      state.closeMark(link);
    }
  },

  softbreak(state, node) {
    if (node.parent!.type === 'paragraph') {
      const { prev, next } = node;

      if (prev && !isBRTag(prev)) {
        state.closeNode();
      }

      if (next && !isBRTag(next)) {
        state.openNode(state.schema.nodes.paragraph);
      }
    }
  },

  linebreak(state) {
    state.addNode(state.schema.nodes.hardBreak);
  },

  // GFM specifications node
  table(state, _, { entering }) {
    const { table } = state.schema.nodes;

    if (entering) {
      state.openNode(table);
    } else {
      state.closeNode();
    }
  },

  tableHead(state, _, { entering }) {
    const { tableHead } = state.schema.nodes;

    if (entering) {
      state.openNode(tableHead);
    } else {
      state.closeNode();
    }
  },

  tableBody(state, _, { entering }) {
    const { tableBody } = state.schema.nodes;

    if (entering) {
      state.openNode(tableBody);
    } else {
      state.closeNode();
    }
  },

  tableRow(state, _, { entering }) {
    const { tableRow } = state.schema.nodes;

    if (entering) {
      state.openNode(tableRow);
    } else {
      state.closeNode();
    }
  },

  tableCell(state, node, { skipChildren }) {
    const { tableHeadCell, tableBodyCell } = state.schema.nodes;
    const tablePart = node.parent!.parent!;
    const cell = tablePart.type === 'tableHead' ? tableHeadCell : tableBodyCell;

    if (skipChildren) {
      skipChildren();
    }

    state.openNode(cell);
    state.convertByDOMParser(node);
    state.closeNode();
  },

  strike(state, _, { entering }) {
    const { strike } = state.schema.marks;

    if (entering) {
      state.openMark(strike.create());
    } else {
      state.closeMark(strike);
    }
  },

  code(state, node) {
    const { code } = state.schema.marks;

    state.openMark(code.create());
    state.addText(getTextWithoutTrailingNewline(node.literal || ''));
    state.closeMark(code);
  },

  customBlock(state, node) {
    const { customBlock, paragraph } = state.schema.nodes;
    const { info, literal } = node as CustomBlockMdNode;

    state.openNode(customBlock, { info });
    state.addText(getTextWithoutTrailingNewline(literal || ''));
    state.closeNode();
    // add empty line to edit the content in next line
    if (!node.next) {
      state.openNode(paragraph);
      state.closeNode();
    }
  },

  htmlInline(state, node) {
    const matched = node.literal!.match(reHTMLTag);

    if (matched) {
      const [, openTagName, , closeTagName] = matched;
      const type = openTagName || closeTagName;

      if (type) {
        const htmlToWwConvertor = htmlToWwConvertors[type.toLowerCase()];

        if (htmlToWwConvertor) {
          htmlToWwConvertor(state, node, openTagName);
        }
      }
    }
  },

  htmlBlock(state, node) {
    const matched = node.literal!.match(reHTMLTag);

    if (matched) {
      const [, openTagName, , closeTagName] = matched;
      const type = openTagName || closeTagName;

      if (type) {
        const htmlToWwConvertor = htmlToWwConvertors[type.toLowerCase()];

        if (htmlToWwConvertor) {
          htmlToWwConvertor(state, node, openTagName);
        }
      }
    }
  }
};
