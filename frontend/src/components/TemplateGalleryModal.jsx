import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { 
  X, 
  Search, 
  Sparkles, 
  Layers, 
  LayoutTemplate, 
  ArrowRight, 
  Check, 
  Loader2,
  Workflow,
  GitCommit,
  Database,
  Cloud
} from 'lucide-react';
import { listTemplates, createFile } from '../lib/api/client';
import { renderDiagramToSVG } from '../lib/engine/renderer';

const CATEGORIES = [
  'All',
  'Flowchart',
  'Sequence',
  'ERD',
  'Cloud Architecture'
];

export default function TemplateGalleryModal({
  isOpen,
  onClose
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingId, setCreatingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    listTemplates()
      .then(res => {
        if (res.success && res.templates) {
          setTemplates(res.templates);
        }
      })
      .catch(err => console.error('Failed to load templates:', err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Filter templates by category and search query
  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      const matchesCategory = selectedCategory === 'All' || 
        tpl.category?.toLowerCase() === selectedCategory.toLowerCase();
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        tpl.name.toLowerCase().includes(q) || 
        tpl.description.toLowerCase().includes(q) ||
        tpl.diagramType.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleUseTemplate = async (tpl) => {
    setCreatingId(tpl.id);
    try {
      const res = await createFile({
        title: tpl.name,
        docContent: `# ${tpl.name}\n\n${tpl.description}\n\n## Overview\nThis workspace was initialized from the official **${tpl.category}** reference template. Edit notes on the left or diagram code on the canvas.`,
        canvasData: JSON.stringify({
          camera: { zoom: 1, panX: 0, panY: 0 },
          diagrams: [
            {
              id: 'diag-1',
              type: 'diagram',
              diagramType: tpl.diagramType,
              code: tpl.code,
              x: 80,
              y: 80
            }
          ]
        })
      });

      if (res.success && res.file) {
        onClose();
        router.push(`/workspace/${res.file.id}`);
      }
    } catch (err) {
      console.error('Failed to create file from template:', err);
    } finally {
      setCreatingId(null);
    }
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Flowchart': return <Workflow size={13} />;
      case 'Sequence': return <GitCommit size={13} />;
      case 'ERD': return <Database size={13} />;
      case 'Cloud Architecture': return <Cloud size={13} />;
      default: return <Layers size={13} />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px'
    }}>
      <div style={{
        backgroundColor: '#1E222D',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '1080px',
        height: '85vh',
        boxShadow: '0 24px 60px rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60A5FA'
            }}>
              <LayoutTemplate size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Template Gallery
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                Start instantly with tested reference diagrams for Flowchart, Sequence, ERD, and Cloud Architecture.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexShrink: 0
        }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="btn"
                style={{
                  height: '30px',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: selectedCategory === cat ? 'var(--accent-primary)' : 'transparent',
                  color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                  border: selectedCategory === cat ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  gap: '6px'
                }}
              >
                {cat !== 'All' && getCategoryIcon(cat)}
                <span>{cat}</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                paddingLeft: '32px',
                paddingRight: '12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '12px'
              }}
            />
          </div>
        </div>

        {/* Template Gallery Grid */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
          alignContent: 'start'
        }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <span>Loading reference template library...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No templates match your search criteria.
            </div>
          ) : (
            filteredTemplates.map(tpl => {
              // Render preview SVG directly through engine
              let previewSvg = '';
              try {
                previewSvg = renderDiagramToSVG(tpl.code, tpl.diagramType);
              } catch (e) {
                previewSvg = `<svg width="300" height="150"><text x="20" y="30" fill="#EF4444">Preview error</text></svg>`;
              }

              const isCreating = creatingId === tpl.id;

              return (
                <div
                  key={tpl.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Card SVG Preview Container */}
                  <div style={{
                    height: '170px',
                    backgroundColor: 'rgba(15, 17, 23, 0.7)',
                    borderBottom: '1px solid var(--border-subtle)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px'
                  }}>
                    <div 
                      dangerouslySetInnerHTML={{ __html: previewSvg }}
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: 'scale(0.85)',
                        transformOrigin: 'center center',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>

                  {/* Card Details */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--accent-subtle)',
                        color: '#60A5FA',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {getCategoryIcon(tpl.category)}
                        <span>{tpl.category}</span>
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {tpl.name}
                    </h4>

                    <p style={{
                      margin: '0 0 16px 0',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.5',
                      flex: 1
                    }}>
                      {tpl.description}
                    </p>

                    {/* Use Template Action */}
                    <button
                      id={`btn-use-template-${tpl.id}`}
                      onClick={() => handleUseTemplate(tpl)}
                      disabled={isCreating}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        height: '32px',
                        fontSize: '12px',
                        gap: '6px',
                        justifyContent: 'center'
                      }}
                    >
                      {isCreating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      <span>{isCreating ? 'Creating Workspace...' : 'Use Template'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
