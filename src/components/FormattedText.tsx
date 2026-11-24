import React from 'react';

interface FormattedTextProps {
  text?: string | null;
  className?: string;
}

const ALLOWED_INLINE_PATTERN = '<(u|b|strong|i|em)>([\\s\\S]*?)<\\/\\1>|<br\\s*\\/?>';

/**
 * Safely renders a small allowlist of inline formatting tags (<u>, <b>, <strong>, <i>, <em>, <br>)
 * as native React elements without using dangerouslySetInnerHTML.
 */
export const FormattedText: React.FC<FormattedTextProps> = ({ text, className }) => {
  if (!text) return null;

  const regex = new RegExp(ALLOWED_INLINE_PATTERN, 'gi');
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const tag = match[1]?.toLowerCase();
    const innerContent = match[2];

    if (!tag && /^<br/i.test(fullMatch)) {
      nodes.push(<br key={`br_${keyIdx++}`} />);
    } else if (tag === 'u') {
      nodes.push(
        <u
          key={`u_${keyIdx++}`}
          className="underline decoration-2 underline-offset-4 decoration-current font-extrabold"
        >
          <FormattedText text={innerContent} />
        </u>
      );
    } else if (tag === 'b' || tag === 'strong') {
      nodes.push(
        <strong key={`b_${keyIdx++}`} className="font-black">
          <FormattedText text={innerContent} />
        </strong>
      );
    } else if (tag === 'i' || tag === 'em') {
      nodes.push(
        <em key={`i_${keyIdx++}`} className="italic">
          <FormattedText text={innerContent} />
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return className ? <span className={className}>{nodes}</span> : <>{nodes}</>;
};
