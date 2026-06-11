// Inject navigation/form guards into AI-generated HTML before loading in a sandboxed iframe.
// Prevents links and forms inside the generated component from hijacking the host app
// (relative URLs would resolve against localhost:3000). Also hides scrollbars for clean previews.
export function frame(html: string): string {
  const guard =
    '<base target="_blank">' +
    "<style>::-webkit-scrollbar{width:0;height:0;display:none}html{scrollbar-width:none;-ms-overflow-style:none}</style>" +
    "<script>" +
    "document.addEventListener('click',function(e){var t=e.target;var a=t&&t.closest?t.closest('a'):null;if(a)e.preventDefault();},true);" +
    "document.addEventListener('submit',function(e){e.preventDefault();},true);" +
    "</script>";
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + guard) : guard + html;
}
